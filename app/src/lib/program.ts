import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export const PROGRAM_ID = new PublicKey(
  "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"
);

// Circle's official devnet USDC mint (6 decimals). The on-chain program
// accepts any mint for place_bet_token/claim_winnings_token — this is a
// frontend-level choice, not an on-chain restriction, so a different/mainnet
// mint can be swapped in later without a redeploy.
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
export const USDC_DECIMALS = 6;

// ─── Transaction confirmation ────────────────────────────────────────────────

// connection.confirmTransaction(signature, commitment) — the signature-only
// overload — has no notion of blockhash expiry and can hang indefinitely if
// the RPC's websocket subscription never fires (common on congested public
// endpoints). Use the blockhash-aware form plus our own hard timeout so the
// caller always gets a resolved/rejected promise instead of a stuck UI.
export async function confirmWithTimeout(
  connection: Connection,
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

function battleIdSeed(battleId: number): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(battleId), true);
  return buf;
}

// seeds = [b"robot", owner, name] — the on-chain program scopes the robot PDA
// to owner+name (one owner can register several robots), so a name is
// required to derive the address. Do not call this with just an owner.
export function getRobotPDA(owner: PublicKey, name: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("robot"), owner.toBuffer(), new TextEncoder().encode(name)],
    PROGRAM_ID
  );
}

const ROBOT_DISCRIMINATOR = Uint8Array.from([34, 202, 182, 118, 208, 196, 10, 226]);

export function getBattlePDA(battleId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("battle"), battleIdSeed(battleId)],
    PROGRAM_ID
  );
}

export function getBetPDA(battleId: number, bettor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("bet"), battleIdSeed(battleId), bettor.toBuffer()],
    PROGRAM_ID
  );
}

// ─── SPL token (e.g. USDC) backing PDAs ──────────────────────────────────────
// Pooled separately per mint (place_bet_token/claim_winnings_token) so
// currencies never mix into one payout pool — see on-chain lib.rs.

export function getBetTokenPDA(battleId: number, mint: PublicKey, bettor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("bet_token"), battleIdSeed(battleId), mint.toBuffer(), bettor.toBuffer()],
    PROGRAM_ID
  );
}

export function getVaultAuthorityPDA(battleId: number, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("vault_auth"), battleIdSeed(battleId), mint.toBuffer()],
    PROGRAM_ID
  );
}

export function getVaultTokenPDA(battleId: number, mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("vault_token"), battleIdSeed(battleId), mint.toBuffer()],
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

function decodeRobot(pda: PublicKey, d: Buffer | Uint8Array): RobotState {
  const buf = d instanceof Buffer ? d : Buffer.from(d);
  const nameLen = buf.readUInt32LE(40);
  const name = buf.subarray(44, 44 + nameLen).toString("utf8");
  const b = 44 + nameLen;
  return {
    pda: pda.toString(),
    owner: new PublicKey(buf.subarray(8, 40)).toString(),
    name,
    attack: buf[b],
    defense: buf[b + 1],
    speed: buf[b + 2],
    wins: buf.readUInt32LE(b + 3),
    losses: buf.readUInt32LE(b + 7),
    hp: buf[b + 11],
    isActive: buf[b + 12] !== 0,
  };
}

// One owner can register several robots (PDA is scoped by owner+name), so
// "which robots does this wallet have" can't be answered by guessing a PDA —
// scan for Robot accounts whose owner field (offset 8, 32 bytes) matches.
export async function fetchRobotsByOwner(
  connection: Connection,
  owner: PublicKey
): Promise<RobotState[]> {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { memcmp: { offset: 0, bytes: bs58.encode(ROBOT_DISCRIMINATOR) } },
      { memcmp: { offset: 8, bytes: owner.toBase58() } },
    ],
  });
  return accounts.map((a) => decodeRobot(a.pubkey, a.account.data));
}

// Fetch a single, already-known robot by its exact PDA (e.g. to decode
// chainBattle.robotA/robotB, whose owner may not be the connected wallet).
export async function fetchRobotByPDA(
  connection: Connection,
  pda: PublicKey
): Promise<RobotState | null> {
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return decodeRobot(pda, info.data);
}

// ─── Battle struct deserialization ───────────────────────────────────────────
// Layout (Anchor 8-byte discriminator prefix):
//   0-7   discriminator
//   8-15  battle_id (u64 LE)
//  16-47  robot_a (Pubkey)
//  48-79  robot_b (Pubkey)
//  80-111 owner_a (Pubkey)
// 112-119 entry_fee (u64 LE)
// 120-127 total_bets_a (u64 LE, SOL)
// 128-135 total_bets_b (u64 LE, SOL)
//   136   hp_a (u8)
//   137   hp_b (u8)
//   138   status (0=Waiting 1=Active 2=Finished)
// 139-140 winner (Option<u8>)
//   141   bump (u8)
// 142-149 total_back_a_usdc (u64 LE) — appended for SPL token backing
// 150-157 total_back_b_usdc (u64 LE)

export interface BattleOnChainState {
  robotA: string;
  robotB: string;
  status: number;
  totalBackAUsdc: number;
  totalBackBUsdc: number;
}

function readU64LE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return Number(view.getBigUint64(offset, true));
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
    totalBackAUsdc: d.length >= 150 ? readU64LE(d, 142) : 0,
    totalBackBUsdc: d.length >= 158 ? readU64LE(d, 150) : 0,
  };
}
