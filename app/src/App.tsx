import { useState, useEffect } from "react";
import { HealthBar } from "./components/HealthBar";
import { Commentary } from "./components/Commentary";
import { VoiceControl } from "./components/VoiceControl";
import { Arena } from "./components/Arena";
import { WalletButton } from "./components/WalletButton";
import { BettingPanel } from "./components/BettingPanel";
import { useArenaSocket } from "./hooks/useWebSocket";
import { MatchState, DamageEvent, SensorUpdate } from "./types";

const ARENA_ID = 1;

const DEFAULT_STATE: MatchState = {
  arenaId: ARENA_ID,
  hpA: 100,
  hpB: 100,
  round: 1,
  status: "Active",
  winner: null,
};

export default function App() {
  const { connected, lastEvent } = useArenaSocket(ARENA_ID);
  const [match, setMatch] = useState<MatchState>(DEFAULT_STATE);
  const [commentary, setCommentary] = useState<string[]>([
    "Welcome to Proof of Battle.",
    "On-chain arena initialized. Awaiting combat...",
  ]);
  const [lastAudio, setLastAudio] = useState<string | undefined>();
  const [posA, setPosA] = useState({ x: -1.2, y: 0 });
  const [posB, setPosB] = useState({ x: 1.2, y: 0 });
  const [txLog, setTxLog] = useState<string[]>([]);
  const [bets, setBets] = useState({ a: 0, b: 0 });

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "damage") {
      const e = lastEvent as DamageEvent & { totalBetsA?: number; totalBetsB?: number };
      if (e.totalBetsA !== undefined) setBets({ a: e.totalBetsA, b: e.totalBetsB ?? 0 });
      setMatch((m) => ({ ...m, hpA: e.hpA, hpB: e.hpB }));
      setCommentary((c) => [
        ...c.slice(-30),
        `${e.attacker === "robot_a" ? "[A]" : "[B]"} → ${e.damage} DMG → ${e.target === "robot_a" ? "[A]" : "[B]"}`,
      ]);
      if (e.commentaryAudio) setLastAudio(e.commentaryAudio);
      if (e.tx) setTxLog((l) => [`⛓ ${e.tx.slice(0, 20)}…`, ...l].slice(0, 6));
    }

    if (lastEvent.type === "sensor_update") {
      const e = lastEvent as SensorUpdate;
      setPosA(e.robotA.position);
      setPosB(e.robotB.position);
      setMatch((m) => ({ ...m, hpA: e.robotA.hp, hpB: e.robotB.hp }));
    }

    if (lastEvent.type === "match_over") {
      setMatch((m) => ({ ...m, status: "Finished", winner: lastEvent.winner }));
      setCommentary((c) => [...c, `*** MATCH OVER — WINNER: ${lastEvent.winner} ***`]);
    }
  }, [lastEvent]);

  const isFinished = match.status === "Finished";

  return (
    <div className="min-h-dvh bg-[#05050f] text-white font-mono flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-[#05050f]/90 backdrop-blur border-b border-gray-900 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-black tracking-[0.15em] text-glow-white">
            ⚔ PROOF OF BATTLE
          </h1>
          <p className="text-[9px] text-gray-600 tracking-[0.2em] uppercase mt-0.5">
            Solana Devnet · Arena #{ARENA_ID}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <WalletButton />
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-live-blink" : "bg-gray-700"}`}
            />
            <span className={`text-[9px] font-bold tracking-widest ${connected ? "text-green-400" : "text-gray-600"}`}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4 flex flex-col gap-4">

        {/* Match over banner */}
        {isFinished && match.winner && (
          <div className="border border-yellow-700/60 rounded-lg p-4 text-center bg-yellow-950/30">
            <p className="text-xs tracking-[0.3em] text-yellow-600 uppercase mb-1">Match Over</p>
            <p className="text-2xl font-black animate-winner-pulse text-yellow-300">
              ★ WINNER ★
            </p>
            <p className="text-xs text-yellow-500 font-mono mt-1 truncate">
              {match.winner}
            </p>
          </div>
        )}

        {/* ── HP PANEL — confrontational ── */}
        <div className="bg-[#08080f] border border-gray-900 rounded-lg p-3 flex flex-col gap-2">
          <HealthBar hp={match.hpA} label="UNIT ALPHA" side="a" />

          {/* VS divider */}
          <div className="flex items-center gap-2 py-0.5">
            <div className="flex-1 h-px bg-gradient-to-r from-blue-900/60 to-transparent" />
            <span className="text-[10px] font-black tracking-[0.4em] text-gray-600">VS</span>
            <div className="flex-1 h-px bg-gradient-to-l from-red-900/60 to-transparent" />
          </div>

          <HealthBar hp={match.hpB} label="UNIT BETA" side="b" flip />
        </div>

        {/* ── ARENA CANVAS ── */}
        <div className="bg-[#08080f] border border-gray-900 rounded-lg p-2">
          <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase px-1 pb-1">
            Top-down view · Real-time
          </p>
          <Arena posA={posA} posB={posB} hpA={match.hpA} hpB={match.hpB} />
        </div>

        {/* ── BETTING PANEL ── */}
        <BettingPanel
          arenaId={ARENA_ID}
          totalBetsA={bets.a}
          totalBetsB={bets.b}
          isFinished={isFinished}
        />

        {/* ── COMMENTARY ── */}
        <Commentary lines={commentary} audioBase64={lastAudio} />

        {/* ── VOICE CONTROLS ── */}
        <div className="grid grid-cols-2 gap-2">
          <VoiceControl arenaId={ARENA_ID} robotId="robot_a" />
          <VoiceControl arenaId={ARENA_ID} robotId="robot_b" />
        </div>

        {/* ── TX LOG ── */}
        {txLog.length > 0 && (
          <div className="border border-gray-900 rounded-lg p-2.5 bg-[#08080f]">
            <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase mb-1.5">
              On-chain log
            </p>
            {txLog.map((tx, i) => (
              <p key={i} className="text-[10px] font-mono text-green-700 leading-5">{tx}</p>
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-900 px-4 py-2 flex items-center justify-between">
        <span className="text-[8px] tracking-[0.3em] text-gray-700 uppercase">Proof of Battle v1</span>
        <div className="flex gap-1">
          {["#3b82f6", "#6366f1", "#ef4444"].map((c, i) => (
            <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </footer>
    </div>
  );
}
