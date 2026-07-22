import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BRIDGE_HTTP_URL as BRIDGE_HTTP } from "../lib/bridge";

interface Props {
  onJoin: (battleId: number) => void;
}

type BattleRecord = {
  battle_id: number;
  name: string;
  location: string;
  status: "waiting" | "active" | "finished";
  robot_a_name: string;
  robot_b_name: string;
  robot_a_attack?: number;
  robot_a_defense?: number;
  robot_a_speed?: number;
  robot_b_attack?: number;
  robot_b_defense?: number;
  robot_b_speed?: number;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:   { label: "● LIVE",    cls: "border-green-800 text-green-400 bg-green-950/40" },
  waiting:  { label: "◎ WAITING", cls: "border-yellow-800 text-yellow-400 bg-yellow-950/40" },
  finished: { label: "○ ENDED",   cls: "border-border text-muted bg-surface/40" },
};

export function History({ onJoin }: Props) {
  const { publicKey } = useWallet();
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const resp = await fetch(
        `${BRIDGE_HTTP}/api/battles/history/${publicKey.toBase58()}`
      );
      if (resp.ok) {
        const data: BattleRecord[] = await resp.json();
        setBattles(data);
      }
    } catch {
      /* bridge offline */
    }
    setLoading(false);
  }, [publicKey]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 p-4">
        <span className="text-4xl opacity-20">📜</span>
        <p className="text-[10px] text-muted font-mono tracking-widest">
          CONNECT WALLET TO VIEW HISTORY
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black tracking-[0.3em] text-foreground uppercase">
            My Battles
          </h2>
          <p className="text-[9px] text-muted tracking-wider mt-0.5">
            Competitions you created
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="text-[8px] font-mono text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors tracking-widest"
        >
          ↻ REFRESH
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-[10px] text-muted font-mono animate-pulse">LOADING…</p>
        </div>
      ) : battles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="text-4xl opacity-20">📜</span>
          <p className="text-[10px] text-muted font-mono tracking-widest">NO BATTLES YET</p>
          <p className="text-[9px] text-muted text-center max-w-xs">
            Create a competition in the COMPETE tab to start your battle history.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {battles.map((b) => {
            const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.waiting;
            return (
              <div
                key={b.battle_id}
                className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-black text-foreground tracking-wider truncate">
                      {b.name}
                    </h3>
                    <p className="text-[8px] text-muted font-mono mt-0.5">
                      📍 {b.location} · ID {b.battle_id}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[8px] font-bold font-mono border px-2.5 py-1 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                {/* Combatants */}
                <div className="flex items-center gap-2 text-[9px] font-mono">
                  <span className="text-blue-400 font-bold truncate max-w-[40%]">
                    {b.robot_a_name}
                  </span>
                  <span className="text-muted">VS</span>
                  <span className="text-red-400 font-bold truncate max-w-[40%]">
                    {b.robot_b_name}
                  </span>
                </div>

                {b.robot_a_attack != null && (
                  <div className="flex gap-4 text-[8px] font-mono">
                    <span className="text-blue-700">
                      A: {b.robot_a_attack}·{b.robot_a_defense}·{b.robot_a_speed}
                    </span>
                    <span className="text-red-900">
                      B: {b.robot_b_attack}·{b.robot_b_defense}·{b.robot_b_speed}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => onJoin(b.battle_id)}
                  disabled={b.status === "waiting"}
                  className={`w-full py-2 rounded-lg font-black text-[10px] tracking-[0.2em] transition-all border ${
                    b.status === "active"
                      ? "bg-green-900/40 hover:bg-green-900/60 border-green-800/60 text-green-300"
                      : b.status === "finished"
                      ? "bg-surface/40 hover:bg-surface border-border text-muted hover:text-foreground"
                      : "bg-surface border-border text-muted cursor-not-allowed"
                  }`}
                >
                  {b.status === "active"
                    ? "▶ JOIN LIVE"
                    : b.status === "finished"
                    ? "◎ VIEW REPLAY"
                    : "◎ NOT STARTED"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
