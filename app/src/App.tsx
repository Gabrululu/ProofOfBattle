import { useState, useEffect } from "react";
import { HealthBar } from "./components/HealthBar";
import { Commentary } from "./components/Commentary";
import { VoiceControl } from "./components/VoiceControl";
import { Arena } from "./components/Arena";
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
  const [commentary, setCommentary] = useState<string[]>(["Welcome to Proof of Battle!", "Commands are live — grab the mic!"]);
  const [lastAudio, setLastAudio] = useState<string | undefined>();
  const [posA, setPosA] = useState({ x: -1.2, y: 0 });
  const [posB, setPosB] = useState({ x: 1.2, y: 0 });
  const [txLog, setTxLog] = useState<string[]>([]);

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === "damage") {
      const e = lastEvent as DamageEvent;
      setMatch((m) => ({ ...m, hpA: e.hpA, hpB: e.hpB }));
      setCommentary((c) => [
        ...c.slice(-20),
        `💥 ${e.attacker.toUpperCase()} deals ${e.damage} dmg to ${e.target.toUpperCase()}!`,
      ]);
      if (e.commentaryAudio) setLastAudio(e.commentaryAudio);
      if (e.tx) setTxLog((l) => [`${e.tx.slice(0, 16)}…`, ...l].slice(0, 5));
    }

    if (lastEvent.type === "sensor_update") {
      const e = lastEvent as SensorUpdate;
      setPosA(e.robotA.position);
      setPosB(e.robotB.position);
      setMatch((m) => ({ ...m, hpA: e.robotA.hp, hpB: e.robotB.hp }));
    }

    if (lastEvent.type === "match_over") {
      setMatch((m) => ({ ...m, status: "Finished", winner: lastEvent.winner }));
      setCommentary((c) => [...c, `🏆 WINNER: ${lastEvent.winner}!`]);
    }
  }, [lastEvent]);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-mono">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black tracking-tight">⚔️ PROOF OF BATTLE</h1>
          <p className="text-xs text-gray-500">On-chain arena · Arena #{ARENA_ID}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
            {connected ? "● Live" : "● Disconnected"}
          </span>
          <span className={`text-xs font-bold ${match.status === "Finished" ? "text-yellow-400" : "text-green-400"}`}>
            Round {match.round} · {match.status}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Match over banner */}
        {match.status === "Finished" && match.winner && (
          <div className="bg-yellow-900 border border-yellow-600 rounded-2xl p-4 text-center animate-pulse">
            <p className="text-2xl font-black text-yellow-300">🏆 MATCH OVER</p>
            <p className="text-sm text-yellow-200 mt-1">Winner: {match.winner.slice(0, 20)}…</p>
          </div>
        )}

        {/* Health bars */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-col gap-3">
          <HealthBar hp={match.hpA} label="Robot A — Blue" color="blue" />
          <div className="border-t border-gray-800" />
          <HealthBar hp={match.hpB} label="Robot B — Red" color="red" flip />
        </div>

        {/* Arena top-down view */}
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest">Arena View</p>
          <Arena posA={posA} posB={posB} hpA={match.hpA} hpB={match.hpB} />
        </div>

        {/* Voice controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VoiceControl arenaId={ARENA_ID} robotId="robot_a" />
          <VoiceControl arenaId={ARENA_ID} robotId="robot_b" />
        </div>

        {/* Commentary */}
        <Commentary lines={commentary} audioBase64={lastAudio} />

        {/* On-chain TX log */}
        {txLog.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              ⛓ On-chain Transactions (Devnet)
            </p>
            {txLog.map((tx, i) => (
              <p key={i} className="text-xs font-mono text-green-400">{tx}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
