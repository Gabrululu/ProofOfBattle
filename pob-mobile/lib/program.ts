import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, RPC_ENDPOINT } from "./constants";

export const connection = new Connection(RPC_ENDPOINT, "confirmed");

// ─── Transaction confirmation ────────────────────────────────────────────────

// connection.confirmTransaction(signature, commitment) — the signature-only
// overload — has no notion of blockhash expiry and can hang indefinitely if
// the RPC's websocket subscription never fires (common on congested public
// endpoints). Use the blockhash-aware form plus our own hard timeout so the
// caller always gets a resolved/rejected promise instead of a stuck UI.
export async function confirmWithTimeout(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
  timeoutMs = 30000
): Promise<void> {
  const confirmation = connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(
        `Confirmation timed out — check devnet explorer for ${signature.slice(0, 12)}…`
      )),
      timeoutMs
    );
  });
  try {
    const { value } = await Promise.race([confirmation, timeout]);
    if (value.err) throw new Error(`On-chain error: ${JSON.stringify(value.err)}`);
  } finally {
    clearTimeout(timer!);
    confirmation.catch(() => {}); // avoid unhandled rejection if timeout won the race
  }
}

// ─── PDA helpers ─────────────────────────────────────────────────────────────

function battleIdBuffer(battleId: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(battleId));
  return buf;
}

export function getBattlePDA(battleId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("battle"), battleIdBuffer(battleId)],
    PROGRAM_ID
  );
}

export function getVaultPDA(battleId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), battleIdBuffer(battleId)],
    PROGRAM_ID
  );
}

export function getBetPDA(
  battleId: number,
  bettor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("bet"), battleIdBuffer(battleId), bettor.toBuffer()],
    PROGRAM_ID
  );
}

// ─── Battle struct deserialization ───────────────────────────────────────────
// Layout (Anchor 8-byte discriminator prefix):
//   0-7   discriminator
//   8-15  battle_id (u64 LE)
//  16-47  robot_a (Pubkey)
//  48-79  robot_b (Pubkey)
//  80-111 owner_a (Pubkey)
// 112-119 entry_fee (u64 LE)
// 120-127 total_bets_a (u64 LE)
// 128-135 total_bets_b (u64 LE)
//   136   hp_a (u8)
//   137   hp_b (u8)
//   138   status (0=Waiting 1=Active 2=Finished)
//   139   winner Option discriminant (0=None 1=Some)
//   140   winner value (u8, valid when [139]==1)
//   141   bump (u8)

function readU64LE(buf: Buffer, offset: number): number {
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readUInt32LE(offset + 4);
  // Safe for devnet lamport amounts (< 2^53)
  return hi * 0x100000000 + lo;
}

// ─── Robot PDA ───────────────────────────────────────────────────────────────

export function getRobotPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("robot"), owner.toBuffer()],
    PROGRAM_ID
  );
}

// ─── Robot struct deserialization ─────────────────────────────────────────────
// Layout (8-byte discriminator prefix):
//   0-7   discriminator
//   8-39  owner (Pubkey)
//  40-43  name length (u32 LE)
//  44-..  name (UTF-8 string, length from above)
//  base+0 attack (u8)
//  base+1 defense (u8)
//  base+2 speed (u8)
//  base+3 wins (u32 LE)
//  base+7 losses (u32 LE)
// base+11 hp (u8)
// base+12 is_active (bool)
// base+13 bump (u8)

export interface RobotState {
  pda: string;
  owner: string;
  name: string;
  attack: number;
  defense: number;
  speed: number;
  wins: number;
  losses: number;
  hp: number;
  isActive: boolean;
}

export async function fetchRobotState(owner: PublicKey): Promise<RobotState | null> {
  const [robotPDA] = getRobotPDA(owner);
  const accountInfo = await connection.getAccountInfo(robotPDA);
  if (!accountInfo) return null;

  const d = accountInfo.data as Buffer;
  const nameLen = d.readUInt32LE(40);
  const name = d.subarray(44, 44 + nameLen).toString("utf8");
  const b = 44 + nameLen;
  return {
    pda: robotPDA.toString(),
    owner: new PublicKey(d.subarray(8, 40)).toString(),
    name,
    attack: d[b],
    defense: d[b + 1],
    speed: d[b + 2],
    wins: d.readUInt32LE(b + 3),
    losses: d.readUInt32LE(b + 7),
    hp: d[b + 11],
    isActive: d[b + 12] !== 0,
  };
}

// ─── Instruction discriminators ──────────────────────────────────────────────

export const CLAIM_WINNINGS_DISCRIMINATOR = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);
export const REGISTER_ROBOT_DISCRIMINATOR = Buffer.from([197, 125, 231, 27, 239, 130, 255, 186]);

export function serializeRegisterRobot(
  name: string,
  attack: number,
  defense: number,
  speed: number
): Buffer {
  const nameBytes = Buffer.from(name, "utf8");
  const nameLenBuf = Buffer.alloc(4);
  nameLenBuf.writeUInt32LE(nameBytes.length);
  return Buffer.concat([
    REGISTER_ROBOT_DISCRIMINATOR,
    nameLenBuf,
    nameBytes,
    Buffer.from([attack, defense, speed]),
  ]);
}

// ─── Bet struct deserialization ───────────────────────────────────────────────
// Layout (8-byte discriminator prefix):
//   8-39   bettor (Pubkey, 32 bytes)
//  40-47   battle_id (u64 LE)
//    48    side (u8)
//  49-56   amount (u64 LE)
//    57    claimed (bool)
//    58    bump (u8)

export async function fetchBetState(battleId: number, bettor: PublicKey) {
  const [betPDA] = getBetPDA(battleId, bettor);
  const accountInfo = await connection.getAccountInfo(betPDA);
  if (!accountInfo) return null;

  const d = accountInfo.data as Buffer;
  return {
    bettor: new PublicKey(d.subarray(8, 40)),
    battleId: readU64LE(d, 40),
    side: d[48],
    amount: readU64LE(d, 49),
    claimed: d[57] !== 0,
    bump: d[58],
  };
}

export async function fetchBattleState(battleId: number) {
  const [battlePDA] = getBattlePDA(battleId);
  const accountInfo = await connection.getAccountInfo(battlePDA);
  if (!accountInfo) return null;

  const d = accountInfo.data as Buffer;
  const winnerDiscriminant = d[139];

  return {
    battleId,
    pda: battlePDA.toString(),
    robotA: new PublicKey(d.subarray(16, 48)).toString(),
    robotB: new PublicKey(d.subarray(48, 80)).toString(),
    hpA: d[136],
    hpB: d[137],
    status: d[138],
    totalBetsA: readU64LE(d, 120),
    totalBetsB: readU64LE(d, 128),
    // 255 = no winner yet
    winner: winnerDiscriminant === 1 ? d[140] : 255,
  };
}
