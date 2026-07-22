import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { ProofOfBattle } from "../target/types/proof_of_battle";
import { assert } from "chai";

describe("proof-of-battle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ProofOfBattle as Program<ProofOfBattle>;
  const authority = provider.wallet as anchor.Wallet;
  const playerB = anchor.web3.Keypair.generate();

  const battleId = new BN(1);
  const LAMPORTS = anchor.web3.LAMPORTS_PER_SOL;

  let robotAPda: anchor.web3.PublicKey;
  let robotBPda: anchor.web3.PublicKey;
  let battlePda: anchor.web3.PublicKey;

  before(async () => {
    [robotAPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("robot"), authority.publicKey.toBuffer(), Buffer.from("Destructor-9000")],
      program.programId
    );
    [robotBPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("robot"), playerB.publicKey.toBuffer(), Buffer.from("Shredder-X")],
      program.programId
    );
    [battlePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("battle"), battleId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    // Fund playerB
    const sig = await provider.connection.requestAirdrop(playerB.publicKey, 2 * LAMPORTS);
    await provider.connection.confirmTransaction({ signature: sig, blockhash: (await provider.connection.getLatestBlockhash()).blockhash, lastValidBlockHeight: (await provider.connection.getLatestBlockhash()).lastValidBlockHeight });
  });

  it("Registers robot A with stats", async () => {
    await program.methods
      .registerRobot("Destructor-9000", 80, 60, 70)
      .accounts({ owner: authority.publicKey })
      .rpc();

    const robot = await program.account.robot.fetch(robotAPda);
    assert.equal(robot.name, "Destructor-9000");
    assert.equal(robot.attack, 80);
    assert.equal(robot.defense, 60);
    assert.equal(robot.speed, 70);
    assert.equal(robot.hp, 100);
    assert.isTrue(robot.isActive);
  });

  it("Registers robot B with stats", async () => {
    await program.methods
      .registerRobot("Shredder-X", 90, 40, 85)
      .accounts({ owner: playerB.publicKey })
      .signers([playerB])
      .rpc();

    const robot = await program.account.robot.fetch(robotBPda);
    assert.equal(robot.name, "Shredder-X");
  });

  it("Creates a battle with entry fee and vault", async () => {
    const entryFee = new BN(0.1 * LAMPORTS);
    await program.methods
      .createBattle(battleId, entryFee)
      .accounts({
        robotA: robotAPda,
        robotB: robotBPda,
      })
      .rpc();

    const battle = await program.account.battle.fetch(battlePda);
    assert.equal(battle.hpA, 100);
    assert.equal(battle.hpB, 100);
    assert.deepEqual(battle.status, { waiting: {} });
    assert.isNull(battle.winner);
  });

  it("Places a bet on robot A", async () => {
    const betAmount = new BN(0.5 * LAMPORTS);

    await program.methods
      .placeBet(battleId, 0, betAmount)
      .accounts({})
      .rpc();

    const battle = await program.account.battle.fetch(battlePda);
    assert.equal(battle.totalBetsA.toString(), betAmount.toString());
  });

  it("Starts the battle", async () => {
    await program.methods
      .startBattle(battleId)
      .accounts({})
      .rpc();

    const battle = await program.account.battle.fetch(battlePda);
    assert.deepEqual(battle.status, { active: {} });
  });

  it("Reports damage and updates HP", async () => {
    await new Promise<void>((resolve, reject) => {
      const listener = program.addEventListener("damageReported", async (e) => {
        try {
          assert.equal(e.damage, 25);
          assert.equal(e.hpB, 75);
          await program.removeEventListener(listener);
          resolve();
        } catch (err) {
          await program.removeEventListener(listener);
          reject(err);
        }
      });

      program.methods
        .reportDamage(battleId, 1, 25)
        .accounts({})
        .rpc()
        .catch(reject);
    });

    const battle = await program.account.battle.fetch(battlePda);
    assert.equal(battle.hpB, 75);
  });

  it("Resolves battle and updates win/loss records", async () => {
    for (const dmg of [25, 25, 25]) {
      await program.methods
        .reportDamage(battleId, 1, dmg)
        .accounts({})
        .rpc();
    }

    await program.methods
      .resolveBattle(battleId, 0)
      .accounts({
        robotA: robotAPda,
        robotB: robotBPda,
      })
      .rpc();

    const battle = await program.account.battle.fetch(battlePda);
    assert.deepEqual(battle.status, { finished: {} });
    assert.equal(battle.winner, 0, "El ganador debe ser el robot A (side 0)");

    const robotA = await program.account.robot.fetch(robotAPda);
    const robotB = await program.account.robot.fetch(robotBPda);
    assert.equal(robotA.wins, 1);
    assert.equal(robotB.losses, 1);
  });

  it("Winner claims winnings from vault", async () => {
    const [betPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("bet"), battleId.toArrayLike(Buffer, "le", 8), authority.publicKey.toBuffer()],
      program.programId
    );

    const balanceBefore = await provider.connection.getBalance(authority.publicKey);

    await program.methods
      .claimWinnings(battleId)
      .accounts({})
      .rpc();

    const balanceAfter = await provider.connection.getBalance(authority.publicKey);
    assert.isAbove(balanceAfter, balanceBefore);

    const bet = await program.account.bet.fetch(betPda);
    assert.isTrue(bet.claimed);
  });
});
