/**
 * Devnet setup script — registers robots, creates, and starts battle #1.
 *
 * Run:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
 *   ANCHOR_WALLET=~/.config/solana/id.json \
 *   yarn ts-mocha -p ./tsconfig.json -t 120000 scripts/setup_battle.ts
 *
 * Safe to re-run — already-initialized accounts are detected and skipped.
 */
import * as anchor from "@coral-xyz/anchor";
import { BN, Program, AnchorProvider } from "@coral-xyz/anchor";
import type { ProofOfBattle } from "../target/types/proof_of_battle";
// IDL JSON lives in bridge/idl/ (shared between bridge and scripts)
import idlJson from "../../bridge/idl/proof_of_battle.json";

// Read from the IDL rather than hardcoding — the on-chain program's real
// devnet address is 9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP
// (declare_id! in lib.rs, Anchor.toml's [programs.devnet]); a previous
// hardcoded value here was actually the [programs.localnet] address, so
// every PDA this script derived failed the on-chain seeds constraint.
const PROGRAM_ID = new anchor.web3.PublicKey((idlJson as any).address);

const ROBOT_A_NAME = "UNIT_ALPHA";
const ROBOT_B_NAME = "UNIT_BETA";
const BATTLE_ID    = new BN(1);
const ENTRY_FEE    = new BN(0);

// Robot stats (0-100)
const A_ATK = 80, A_DEF = 60, A_SPD = 70;
const B_ATK = 70, B_DEF = 80, B_SPD = 65;

function pda(seeds: Buffer[], programId: anchor.web3.PublicKey) {
  return anchor.web3.PublicKey.findProgramAddressSync(seeds, programId)[0];
}

describe("setup-battle-devnet", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(idlJson as any, provider) as Program<ProofOfBattle>;
  const authority = provider.wallet as anchor.Wallet;

  let robotAPda: anchor.web3.PublicKey;
  let robotBPda: anchor.web3.PublicKey;
  let battlePda: anchor.web3.PublicKey;
  let vaultPda:  anchor.web3.PublicKey;

  before(() => {
    const battleIdBuf = BATTLE_ID.toArrayLike(Buffer, "le", 8);

    robotAPda = pda(
      [Buffer.from("robot"), authority.publicKey.toBuffer(), Buffer.from(ROBOT_A_NAME)],
      PROGRAM_ID
    );
    robotBPda = pda(
      [Buffer.from("robot"), authority.publicKey.toBuffer(), Buffer.from(ROBOT_B_NAME)],
      PROGRAM_ID
    );
    battlePda = pda([Buffer.from("battle"), battleIdBuf], PROGRAM_ID);
    vaultPda  = pda([Buffer.from("vault"),  battleIdBuf], PROGRAM_ID);

    console.log("\nAuthority :", authority.publicKey.toBase58());
    console.log("Robot A PDA:", robotAPda.toBase58());
    console.log("Robot B PDA:", robotBPda.toBase58());
    console.log("Battle PDA :", battlePda.toBase58());
    console.log("Vault PDA  :", vaultPda.toBase58());
  });

  it("registers Robot A (UNIT_ALPHA)", async () => {
    try {
      const tx = await program.methods
        .registerRobot(ROBOT_A_NAME, A_ATK, A_DEF, A_SPD)
        .accounts({ owner: authority.publicKey })
        .rpc();
      console.log("Robot A registered:", tx);
    } catch (e: any) {
      if (accountAlreadyExists(e)) {
        console.log("Robot A already registered — skipping");
      } else {
        throw e;
      }
    }
  });

  it("registers Robot B (UNIT_BETA)", async () => {
    try {
      const tx = await program.methods
        .registerRobot(ROBOT_B_NAME, B_ATK, B_DEF, B_SPD)
        .accounts({ owner: authority.publicKey })
        .rpc();
      console.log("Robot B registered:", tx);
    } catch (e: any) {
      if (accountAlreadyExists(e)) {
        console.log("Robot B already registered — skipping");
      } else {
        throw e;
      }
    }
  });

  it("creates battle #1", async () => {
    try {
      const tx = await program.methods
        .createBattle(BATTLE_ID, ENTRY_FEE)
        .accounts({
          robotA:  robotAPda,
          robotB:  robotBPda,
          creator: authority.publicKey,
        })
        .rpc();
      console.log("Battle #1 created:", tx);
    } catch (e: any) {
      if (accountAlreadyExists(e)) {
        console.log("Battle #1 already created — skipping");
      } else {
        throw e;
      }
    }
  });

  it("starts battle #1", async () => {
    const tx = await program.methods
      .startBattle(BATTLE_ID)
      .accounts({ authority: authority.publicKey })
      .rpc();
    console.log("Battle #1 STARTED:", tx);

    const battle = await program.account.battle.fetch(battlePda);
    console.log(`HP: A=${battle.hpA}  B=${battle.hpB}`);
    console.log("Status:", JSON.stringify(battle.status));
  });
});

function accountAlreadyExists(e: any): boolean {
  const msg: string = e?.message ?? e?.logs?.join(" ") ?? "";
  return (
    msg.includes("already in use") ||
    msg.includes("already been processed") ||
    msg.includes("0x0")  // Anchor "account already initialized"
  );
}
