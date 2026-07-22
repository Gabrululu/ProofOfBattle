import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { useProgram } from "../hooks/useProgram";
import {
  confirmWithTimeout, getBetPDA, getBetTokenPDA, USDC_MINT, USDC_DECIMALS,
} from "../lib/program";

const LAMPORTS = 1_000_000_000;
type Currency = "SOL" | "USDC";

interface Props {
  arenaId: number;
  totalBackA: number;
  totalBackB: number;
  totalBackAUsdc: number;
  totalBackBUsdc: number;
  isFinished: boolean;
  // On-chain battle.status: 0=Waiting, 1=Active, 2=Finished, null=account
  // doesn't exist yet (or hasn't loaded). place_bet only succeeds while
  // Waiting — surface that instead of leaving backing buttons live and doomed.
  chainStatus: number | null;
  nameA?: string;
  nameB?: string;
}

export function BackingPanel({
  arenaId, totalBackA, totalBackB, totalBackAUsdc, totalBackBUsdc,
  isFinished, chainStatus, nameA = "UNIT A", nameB = "UNIT B",
}: Props) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useProgram();
  const [currency, setCurrency] = useState<Currency>("SOL");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState<"a" | "b" | "claim" | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canBack = chainStatus === 0;
  const amountValue = parseFloat(amount);
  const hasValidAmount = !isNaN(amountValue) && amountValue > 0;

  const totalPoolSol = (totalBackA + totalBackB) / LAMPORTS;
  const totalPoolUsdc = (totalBackAUsdc + totalBackBUsdc) / 10 ** USDC_DECIMALS;
  const [poolA, poolB] = currency === "SOL" ? [totalBackA, totalBackB] : [totalBackAUsdc, totalBackBUsdc];
  const pctA = poolA + poolB > 0 ? Math.round((poolA / (poolA + poolB)) * 100) : 50;
  const pctB = 100 - pctA;

  const back = async (side: 0 | 1) => {
    if (!connected) { setVisible(true); return; }
    if (!program || !publicKey || !signTransaction || !hasValidAmount) return;
    const label = side === 0 ? "a" : "b";
    setLoading(label);
    setError(null);
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

      if (currency === "SOL") {
        const lamports = Math.round(amountValue * LAMPORTS);
        const ix = await program.methods
          .placeBet(new BN(arenaId), side, new BN(lamports))
          .accounts({ bettor: publicKey })
          .instruction();
        tx.add(ix);
      } else {
        const baseUnits = Math.round(amountValue * 10 ** USDC_DECIMALS);
        const bettorAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        // Covers first-time USDC backers with no ATA yet — no-op if it already exists.
        tx.add(createAssociatedTokenAccountIdempotentInstruction(publicKey, bettorAta, publicKey, USDC_MINT));
        const ix = await program.methods
          .placeBetToken(new BN(arenaId), side, new BN(baseUnits))
          .accounts({ mint: USDC_MINT, bettorTokenAccount: bettorAta, bettor: publicKey })
          .instruction();
        tx.add(ix);
      }

      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await confirmWithTimeout(connection, sig, blockhash, lastValidBlockHeight);
      setLastTx(sig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("custom program error") ? "Tx failed — check wallet balance" : msg);
    } finally {
      setLoading(null);
    }
  };

  const claim = async () => {
    if (!program || !publicKey || !signTransaction) return;
    setLoading("claim");
    setError(null);
    try {
      // Figure out which currency this wallet backed with — a SOL `Bet` and a
      // USDC `BetToken` are separate accounts, only one (if any) will exist.
      const [betPDA] = getBetPDA(arenaId, publicKey);
      const [betTokenPDA] = getBetTokenPDA(arenaId, USDC_MINT, publicKey);
      const [betInfo, betTokenInfo] = await Promise.all([
        connection.getAccountInfo(betPDA),
        connection.getAccountInfo(betTokenPDA),
      ]);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

      if (betTokenInfo) {
        const bettorAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        const ix = await program.methods
          .claimWinningsToken(new BN(arenaId))
          .accounts({ mint: USDC_MINT, bettorTokenAccount: bettorAta, bettor: publicKey })
          .instruction();
        tx.add(ix);
      } else if (betInfo) {
        const ix = await program.methods
          .claimWinnings(new BN(arenaId))
          .accounts({ bettor: publicKey })
          .instruction();
        tx.add(ix);
      } else {
        setError("No backing found for this wallet on this battle.");
        return;
      }

      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await confirmWithTimeout(connection, sig, blockhash, lastValidBlockHeight);
      setLastTx(sig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("custom program error") ? "Claim failed — no winnings or already claimed" : msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-surface flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] tracking-[0.3em] text-muted uppercase">Respaldar</span>
        <span className="text-[9px] font-mono text-yellow-600">
          {totalPoolSol > 0 && `${totalPoolSol.toFixed(2)} SOL`}
          {totalPoolSol > 0 && totalPoolUsdc > 0 && " · "}
          {totalPoolUsdc > 0 && `${totalPoolUsdc.toFixed(2)} USDC`}
        </span>
      </div>

      {/* Currency toggle */}
      {!isFinished && canBack && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCurrency("SOL")}
            className={`py-1.5 rounded text-[9px] font-mono font-bold tracking-widest border transition-colors ${
              currency === "SOL" ? "border-primary bg-primary/20 text-primary" : "border-border text-muted"
            }`}
          >
            SOL
          </button>
          <button
            onClick={() => setCurrency("USDC")}
            className={`py-1.5 rounded text-[9px] font-mono font-bold tracking-widest border transition-colors ${
              currency === "USDC" ? "border-primary bg-primary/20 text-primary" : "border-border text-muted"
            }`}
          >
            USDC
          </button>
        </div>
      )}

      {/* Odds bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-secondary truncate max-w-[80px]">{nameA} {pctA}%</span>
        <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ background: `linear-gradient(to right, var(--color-secondary) ${pctA}%, var(--color-primary) ${pctA}%)` }}
          />
        </div>
        <span className="text-[9px] font-bold text-primary truncate max-w-[80px] text-right">{pctB}% {nameB}</span>
      </div>

      {/* Backing buttons */}
      {!isFinished ? (
        canBack ? (
          <>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-background border border-border rounded-lg px-2.5 py-2 text-[11px] font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              />
              <span className="text-[9px] font-mono text-muted">{currency}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => back(0)}
                disabled={loading !== null || !hasValidAmount}
                className="py-2.5 rounded border border-secondary/60 bg-secondary/10 text-secondary hover:bg-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[10px] font-black tracking-widest uppercase"
              >
                {loading === "a" ? "◌ ENVIANDO…" : `▲ ${nameA}`}
              </button>
              <button
                onClick={() => back(1)}
                disabled={loading !== null || !hasValidAmount}
                className="py-2.5 rounded border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[10px] font-black tracking-widest uppercase"
              >
                {loading === "b" ? "◌ ENVIANDO…" : `▲ ${nameB}`}
              </button>
            </div>
          </>
        ) : (
          <p className="text-[9px] font-mono text-yellow-600 text-center py-2">
            {chainStatus === null
              ? "⚠ Esta arena todavía no tiene una batalla creada on-chain — no se puede respaldar."
              : "⚠ La batalla ya está en curso — los respaldos están cerrados."}
          </p>
        )
      ) : (
        <button
          onClick={claim}
          disabled={loading !== null || !connected}
          className="w-full py-2.5 rounded border border-yellow-800/60 bg-yellow-950/30 text-yellow-400 hover:bg-yellow-900/30 disabled:opacity-40 disabled:cursor-wait transition-colors text-[10px] font-black tracking-widest uppercase"
        >
          {loading === "claim" ? "◌ RECLAMANDO…" : "★ CLAIM WINNINGS"}
        </button>
      )}

      {/* Feedback */}
      {lastTx && (
        <p className="text-[9px] font-mono text-green-600 truncate animate-slide-up">
          ✓ {lastTx.slice(0, 24)}…
        </p>
      )}
      {error && (
        <p className="text-[9px] font-mono text-red-500 animate-slide-up">{error}</p>
      )}
    </div>
  );
}
