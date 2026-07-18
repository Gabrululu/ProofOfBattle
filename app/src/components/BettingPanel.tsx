import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { BN } from "@coral-xyz/anchor";
import { useProgram } from "../hooks/useProgram";

const LAMPORTS = 1_000_000_000;
const BET_SOL = 0.05;

interface Props {
  arenaId: number;
  totalBetsA: number;
  totalBetsB: number;
  isFinished: boolean;
  nameA?: string;
  nameB?: string;
}

export function BettingPanel({ arenaId, totalBetsA, totalBetsB, isFinished, nameA = "UNIT A", nameB = "UNIT B" }: Props) {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useProgram();
  const [loading, setLoading] = useState<"a" | "b" | "claim" | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPool = (totalBetsA + totalBetsB) / LAMPORTS;
  const pctA = totalBetsA + totalBetsB > 0
    ? Math.round((totalBetsA / (totalBetsA + totalBetsB)) * 100)
    : 50;
  const pctB = 100 - pctA;

  const bet = async (side: 0 | 1) => {
    if (!connected) { setVisible(true); return; }
    if (!program || !publicKey) return;
    const label = side === 0 ? "a" : "b";
    setLoading(label);
    setError(null);
    try {
      const tx = await program.methods
        .placeBet(new BN(arenaId), side, new BN(Math.floor(BET_SOL * LAMPORTS)))
        .accounts({ bettor: publicKey })
        .rpc();
      setLastTx(tx);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("custom program error") ? "Tx failed — check wallet balance" : "Transaction failed");
    } finally {
      setLoading(null);
    }
  };

  const claim = async () => {
    if (!program || !publicKey) return;
    setLoading("claim");
    setError(null);
    try {
      const tx = await program.methods
        .claimWinnings(new BN(arenaId))
        .accounts({ bettor: publicKey })
        .rpc();
      setLastTx(tx);
    } catch (e: unknown) {
      setError("Claim failed — no winnings or already claimed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="border border-gray-900 rounded-lg p-3 bg-[#08080f] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] tracking-[0.3em] text-gray-600 uppercase">Place Bet</span>
        {totalPool > 0 && (
          <span className="text-[9px] font-mono text-yellow-600">
            Pool: {totalPool.toFixed(2)} SOL
          </span>
        )}
      </div>

      {/* Odds bar */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-blue-400 truncate max-w-[80px]">{nameA} {pctA}%</span>
        <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ background: `linear-gradient(to right, #2563eb ${pctA}%, #dc2626 ${pctA}%)` }}
          />
        </div>
        <span className="text-[9px] font-bold text-red-400 truncate max-w-[80px] text-right">{pctB}% {nameB}</span>
      </div>

      {/* Bet buttons */}
      {!isFinished ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => bet(0)}
            disabled={loading !== null}
            className="py-2.5 rounded border border-blue-900/60 bg-blue-950/30 text-blue-400 hover:bg-blue-900/40 disabled:opacity-40 disabled:cursor-wait transition-colors text-[10px] font-black tracking-widest uppercase"
          >
            {loading === "a" ? "◌ SENDING…" : `▲ ${nameA}`}
          </button>
          <button
            onClick={() => bet(1)}
            disabled={loading !== null}
            className="py-2.5 rounded border border-red-900/60 bg-red-950/30 text-red-400 hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-wait transition-colors text-[10px] font-black tracking-widest uppercase"
          >
            {loading === "b" ? "◌ SENDING…" : `▲ ${nameB}`}
          </button>
        </div>
      ) : (
        <button
          onClick={claim}
          disabled={loading !== null || !connected}
          className="w-full py-2.5 rounded border border-yellow-800/60 bg-yellow-950/30 text-yellow-400 hover:bg-yellow-900/30 disabled:opacity-40 disabled:cursor-wait transition-colors text-[10px] font-black tracking-widest uppercase"
        >
          {loading === "claim" ? "◌ CLAIMING…" : "★ CLAIM WINNINGS"}
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
