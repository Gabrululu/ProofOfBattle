import { Connection, PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"
);

// ─── PDA helpers ─────────────────────────────────────────────────────────────

function battleIdSeed(battleId: number): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(battleId), true);
  return buf;
}

export function getRobotPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("robot"), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function getBattlePDA(battleId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("battle"), battleIdSeed(battleId)],
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

export async function fetchRobotState(
  connection: Connection,
  owner: PublicKey
): Promise<RobotState | null> {
  const [robotPDA] = getRobotPDA(owner);
  const accountInfo = await connection.getAccountInfo(robotPDA);
  if (!accountInfo) return null;

  const d = accountInfo.data;
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

export interface BattleOnChainState {
  robotA: string;
  robotB: string;
  status: number;
}

export async function fetchBattleOnChain(
  connection: Connection,
  battleId: number
): Promise<BattleOnChainState | null> {
  const [battlePDA] = getBattlePDA(battleId);
  const accountInfo = await connection.getAccountInfo(battlePDA);
  if (!accountInfo) return null;

  const d = accountInfo.data;
  return {
    robotA: new PublicKey(d.subarray(16, 48)).toString(),
    robotB: new PublicKey(d.subarray(48, 80)).toString(),
    status: d[138],
  };
}
