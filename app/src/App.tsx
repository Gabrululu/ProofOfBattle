import { useState, useEffect } from "react";
import { HealthBar }    from "./components/HealthBar";
import { Commentary }   from "./components/Commentary";
import { VoiceControl } from "./components/VoiceControl";
import { Arena }        from "./components/Arena";
import { WalletButton } from "./components/WalletButton";
import { BettingPanel } from "./components/BettingPanel";
import { useArenaSocket } from "./hooks/useWebSocket";
import { MatchState, DamageEvent, SensorUpdate } from "./types";

const ARENA_ID = 1;

const DEFAULT_STATE: MatchState = {
  arenaId: ARENA_ID,
  hpA: 100, hpB: 100,
  round: 1, status: "Active", winner: null,
};

// ── SVG robot logo ────────────────────────────────────────────────────────────
function RobotLogo({ size = 96 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      style={{ display: "block" }}
    >
      <rect width="32" height="32" rx="5" fill="#05050f"/>
      <rect x="1"  y="10"   width="5" height="2" rx="1" fill="#3b82f6" opacity="0.9"/>
      <rect x="1"  y="14.5" width="5" height="2" rx="1" fill="#3b82f6" opacity="0.6"/>
      <rect x="1"  y="19"   width="5" height="2" rx="1" fill="#3b82f6" opacity="0.4"/>
      <rect x="26" y="10"   width="5" height="2" rx="1" fill="#ef4444" opacity="0.9"/>
      <rect x="26" y="14.5" width="5" height="2" rx="1" fill="#ef4444" opacity="0.6"/>
      <rect x="26" y="19"   width="5" height="2" rx="1" fill="#ef4444" opacity="0.4"/>
      <rect x="11" y="1"    width="2" height="5" rx="1" fill="#6366f1" opacity="0.7"/>
      <rect x="15" y="1"    width="2" height="5" rx="1" fill="#6366f1" opacity="0.5"/>
      <rect x="19" y="1"    width="2" height="5" rx="1" fill="#6366f1" opacity="0.3"/>
      <rect x="11" y="26"   width="2" height="5" rx="1" fill="#6366f1" opacity="0.3"/>
      <rect x="15" y="26"   width="2" height="5" rx="1" fill="#6366f1" opacity="0.5"/>
      <rect x="19" y="26"   width="2" height="5" rx="1" fill="#6366f1" opacity="0.7"/>
      <rect x="6"  y="6"    width="20" height="20" rx="3" fill="#0f172a" stroke="#1e3a5f" strokeWidth="1"/>
      <rect x="8"  y="11"   width="6" height="4" rx="1.5" fill="#3b82f6"/>
      <rect x="9"  y="12"   width="2" height="2" rx="0.5" fill="#93c5fd" opacity="0.8"/>
      <rect x="18" y="11"   width="6" height="4" rx="1.5" fill="#ef4444"/>
      <rect x="19" y="12"   width="2" height="2" rx="0.5" fill="#fca5a5" opacity="0.8"/>
      <rect x="9"  y="19"   width="14" height="1.5" rx="0.5" fill="#1e3a5f"/>
      <rect x="11" y="19"   width="2"  height="1.5" fill="#3b82f6" opacity="0.6"/>
      <rect x="15" y="19"   width="2"  height="1.5" fill="#6366f1" opacity="0.6"/>
      <rect x="19" y="19"   width="2"  height="1.5" fill="#ef4444" opacity="0.6"/>
    </svg>
  );
}

// ── Boot lines ────────────────────────────────────────────────────────────────
const BOOT_LINES = [
  { delay: 0,    color: "text-gray-600",  text: "POBIOS v1.0  ·  PROOF OF BATTLE SYSTEMS" },
  { delay: 300,  color: "text-gray-600",  text: "SOLANA DEVNET  ·  9MFZtJ…MxCP" },
  { delay: 600,  color: "text-cyan-500",  text: "> LOADING VIRTUALS G.A.M.E. AGENT ... [OK]" },
  { delay: 900,  color: "text-cyan-500",  text: "> ELEVENLABS STT/TTS ONLINE ........... [OK]" },
  { delay: 1200, color: "text-cyan-500",  text: "> WEBOTS SIMULATION READY ............. [OK]" },
  { delay: 1500, color: "text-green-400", text: "> ALL SYSTEMS GO — ARENA ONLINE ✓" },
];

function BootLine({ text, color, delay }: { text: string; color: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <p
      className={`text-[10px] font-mono leading-5 transition-opacity duration-300 ${color} ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {text}
    </p>
  );
}

// ── Landing screen ────────────────────────────────────────────────────────────
function Landing({ onEnter }: { onEnter: () => void }) {
  const [ready, setReady] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = () => {
    setPressed(true);
    setTimeout(onEnter, 160);
  };

  return (
    <div className="min-h-dvh bg-[#05050f] flex flex-col items-center justify-center px-6 gap-8"
         style={{ animation: "fade-up 0.6s ease-out both" }}>

      {/* Glow rings + robot */}
      <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
        {[200, 240, 280].map((size, i) => (
          <div
            key={size}
            className="absolute rounded-full border border-purple-500/30"
            style={{
              width: size, height: size,
              animation: `ring-pulse ${2 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 400}ms`,
            }}
          />
        ))}
        <div className="relative z-10 drop-shadow-[0_0_24px_rgba(153,69,255,0.6)]">
          <RobotLogo size={110} />
        </div>
      </div>

      {/* Title */}
      <div className="text-center" style={{ animation: "fade-up 0.7s 0.2s ease-out both" }}>
        <h1 className="text-5xl font-black tracking-[10px] leading-tight text-glow-white">
          PROOF<br />OF BATTLE
        </h1>
        <p className="mt-3 text-[11px] font-mono text-gray-500 tracking-widest">
          Robot combat · On-chain truth · AI at the wheel
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2"
           style={{ animation: "fade-up 0.7s 0.35s ease-out both" }}>
        {[
          { icon: "⛓", label: "ON-CHAIN RECORD", color: "border-purple-700/50 text-purple-400" },
          { icon: "🎙", label: "VOICE COMMANDS",  color: "border-cyan-700/50 text-cyan-400"    },
          { icon: "🤖", label: "AI AGENT (ARES)", color: "border-green-700/50 text-green-400"  },
        ].map((f) => (
          <div key={f.label}
               className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 bg-[#0c0c1a] text-[9px] font-mono font-bold tracking-wider ${f.color}`}>
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Boot terminal */}
      <div className="w-full max-w-sm bg-[#0c0c1a] border border-gray-900 border-l-2 border-l-green-500 rounded-lg p-3 gap-0.5 flex flex-col"
           style={{ animation: "fade-up 0.7s 0.5s ease-out both" }}>
        {BOOT_LINES.map((l) => <BootLine key={l.text} {...l} />)}
      </div>

      {/* CTA button */}
      <div style={{ animation: "fade-up 0.7s 0.65s ease-out both", width: "100%", maxWidth: 360 }}>
        <button
          onClick={handleEnter}
          disabled={!ready}
          className={`w-full py-5 rounded-2xl font-black text-base tracking-[4px] transition-all duration-150
            ${ready
              ? "bg-purple-600 text-white shadow-[0_0_32px_rgba(153,69,255,0.5)] hover:bg-purple-500 hover:shadow-[0_0_48px_rgba(153,69,255,0.7)]"
              : "bg-[#1a0a2e] text-gray-600 cursor-not-allowed"
            }
            ${pressed ? "scale-95" : "scale-100"}
          `}
        >
          {ready ? "ENTER ARENA →" : "INITIALIZING…"}
        </button>
      </div>

      {/* Network badge */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-live-blink" />
        <span className="text-[9px] font-mono text-gray-600 tracking-[4px]">SOLANA DEVNET</span>
      </div>
    </div>
  );
}

// ── Main arena app ────────────────────────────────────────────────────────────
export default function App() {
  const [landed, setLanded] = useState(false);
  const { connected, lastEvent } = useArenaSocket(ARENA_ID);
  const [match, setMatch]       = useState<MatchState>(DEFAULT_STATE);
  const [commentary, setCommentary] = useState<string[]>([
    "Welcome to Proof of Battle.",
    "On-chain arena initialized. Awaiting combat...",
  ]);
  const [lastAudio, setLastAudio] = useState<string | undefined>();
  const [posA, setPosA] = useState({ x: -1.2, y: 0 });
  const [posB, setPosB] = useState({ x:  1.2, y: 0 });
  const [txLog, setTxLog] = useState<string[]>([]);
  const [bets,  setBets]  = useState({ a: 0, b: 0 });

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

  // Show landing first
  if (!landed) return <Landing onEnter={() => setLanded(true)} />;

  const isFinished = match.status === "Finished";

  return (
    <div className="min-h-dvh bg-[#05050f] text-white font-mono flex flex-col"
         style={{ animation: "fade-up 0.4s ease-out both" }}>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-[#05050f]/90 backdrop-blur border-b border-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RobotLogo size={28} />
          <div>
            <h1 className="text-base font-black tracking-[0.15em] text-glow-white">
              ⚔ PROOF OF BATTLE
            </h1>
            <p className="text-[9px] text-gray-600 tracking-[0.2em] uppercase mt-0.5">
              Solana Devnet · Arena #{ARENA_ID}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <WalletButton />
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-live-blink" : "bg-gray-700"}`} />
            <span className={`text-[9px] font-bold tracking-widest ${connected ? "text-green-400" : "text-gray-600"}`}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4 flex flex-col gap-4">

        {isFinished && match.winner && (
          <div className="border border-yellow-700/60 rounded-lg p-4 text-center bg-yellow-950/30">
            <p className="text-xs tracking-[0.3em] text-yellow-600 uppercase mb-1">Match Over</p>
            <p className="text-2xl font-black animate-winner-pulse text-yellow-300">★ WINNER ★</p>
            <p className="text-xs text-yellow-500 font-mono mt-1 truncate">{match.winner}</p>
          </div>
        )}

        <div className="bg-[#08080f] border border-gray-900 rounded-lg p-3 flex flex-col gap-2">
          <HealthBar hp={match.hpA} label="UNIT ALPHA" side="a" />
          <div className="flex items-center gap-2 py-0.5">
            <div className="flex-1 h-px bg-gradient-to-r from-blue-900/60 to-transparent" />
            <span className="text-[10px] font-black tracking-[0.4em] text-gray-600">VS</span>
            <div className="flex-1 h-px bg-gradient-to-l from-red-900/60 to-transparent" />
          </div>
          <HealthBar hp={match.hpB} label="UNIT BETA" side="b" flip />
        </div>

        <div className="bg-[#08080f] border border-gray-900 rounded-lg p-2">
          <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase px-1 pb-1">
            Top-down view · Real-time
          </p>
          <Arena posA={posA} posB={posB} hpA={match.hpA} hpB={match.hpB} />
        </div>

        <BettingPanel
          arenaId={ARENA_ID}
          totalBetsA={bets.a}
          totalBetsB={bets.b}
          isFinished={isFinished}
        />

        <Commentary lines={commentary} audioBase64={lastAudio} />

        <div className="grid grid-cols-2 gap-2">
          <VoiceControl arenaId={ARENA_ID} robotId="robot_a" />
          <VoiceControl arenaId={ARENA_ID} robotId="robot_b" />
        </div>

        {txLog.length > 0 && (
          <div className="border border-gray-900 rounded-lg p-2.5 bg-[#08080f]">
            <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase mb-1.5">On-chain log</p>
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
          {["#9945ff", "#14f195", "#00c2ff"].map((c, i) => (
            <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </footer>
    </div>
  );
}
