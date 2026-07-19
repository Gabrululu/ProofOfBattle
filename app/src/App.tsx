import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { HealthBar }    from "./components/HealthBar";
import { Commentary }   from "./components/Commentary";
import { VoiceControl } from "./components/VoiceControl";
import { Arena }        from "./components/Arena";
import { WalletButton } from "./components/WalletButton";
import { BettingPanel } from "./components/BettingPanel";
import { useArenaSocket } from "./hooks/useWebSocket";
import { useRobot } from "./hooks/useRobot";
import { fetchBattleOnChain, BattleOnChainState } from "./lib/program";
import { MatchState, DamageEvent, SensorUpdate, AppView } from "./types";
import { RobotRegister } from "./views/RobotRegister";
import { CreateCompetition } from "./views/CreateCompetition";
import { StreamBrowser } from "./views/StreamBrowser";
import { Leaderboard } from "./views/Leaderboard";
import { History } from "./views/History";

const DEFAULT_ARENA_ID = 1;

const BRIDGE_HTTP = (import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000").replace(
  /^wss?/,
  (m: string) => (m === "wss" ? "https" : "http")
);

const DEFAULT_STATE: MatchState = {
  arenaId: DEFAULT_ARENA_ID,
  hpA: 100, hpB: 100,
  round: 1, status: "Active", winner: null,
};

// ── SVG robot logo ────────────────────────────────────────────────────────────
function RobotLogo({ size = 96 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }}>
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
    <p className={`text-[10px] font-mono leading-5 transition-opacity duration-300 ${color} ${visible ? "opacity-100" : "opacity-0"}`}>
      {text}
    </p>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
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
      <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
        {[200, 240, 280].map((size, i) => (
          <div key={size} className="absolute rounded-full border border-purple-500/30"
               style={{ width: size, height: size, animation: `ring-pulse ${2 + i * 0.5}s ease-in-out infinite`, animationDelay: `${i * 400}ms` }} />
        ))}
        <div className="relative z-10 drop-shadow-[0_0_24px_rgba(153,69,255,0.6)]">
          <RobotLogo size={110} />
        </div>
      </div>
      <div className="text-center" style={{ animation: "fade-up 0.7s 0.2s ease-out both" }}>
        <h1 className="text-5xl font-black tracking-[10px] leading-tight text-glow-white">
          PROOF<br />OF BATTLE
        </h1>
        <p className="mt-3 text-[11px] font-mono text-gray-500 tracking-widest">
          Robot combat · On-chain truth · AI at the wheel
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2" style={{ animation: "fade-up 0.7s 0.35s ease-out both" }}>
        {[
          { icon: "⛓", label: "ON-CHAIN RECORD", color: "border-purple-700/50 text-purple-400" },
          { icon: "🎙", label: "VOICE COMMANDS",  color: "border-cyan-700/50 text-cyan-400"    },
          { icon: "🤖", label: "AI AGENT (ARES)", color: "border-green-700/50 text-green-400"  },
        ].map((f) => (
          <div key={f.label}
               className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 bg-[#0c0c1a] text-[9px] font-mono font-bold tracking-wider ${f.color}`}>
            <span>{f.icon}</span><span>{f.label}</span>
          </div>
        ))}
      </div>
      <div className="w-full max-w-sm bg-[#0c0c1a] border border-gray-900 border-l-2 border-l-green-500 rounded-lg p-3 gap-0.5 flex flex-col"
           style={{ animation: "fade-up 0.7s 0.5s ease-out both" }}>
        {BOOT_LINES.map((l) => <BootLine key={l.text} {...l} />)}
      </div>
      <div style={{ animation: "fade-up 0.7s 0.65s ease-out both", width: "100%", maxWidth: 360 }}>
        <button
          onClick={handleEnter}
          disabled={!ready}
          className={`w-full py-5 rounded-2xl font-black text-base tracking-[4px] transition-all duration-150
            ${ready ? "bg-purple-600 text-white shadow-[0_0_32px_rgba(153,69,255,0.5)] hover:bg-purple-500" : "bg-[#1a0a2e] text-gray-600 cursor-not-allowed"}
            ${pressed ? "scale-95" : "scale-100"}`}
        >
          {ready ? "ENTER ARENA →" : "INITIALIZING…"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-live-blink" />
        <span className="text-[9px] font-mono text-gray-600 tracking-[4px]">SOLANA DEVNET</span>
      </div>
    </div>
  );
}

// ── Bottom nav tabs ───────────────────────────────────────────────────────────
const TABS: { view: AppView; icon: string; label: string }[] = [
  { view: "live",    icon: "📡", label: "LIVE"    },
  { view: "arena",   icon: "⚔",  label: "ARENA"   },
  { view: "robot",   icon: "🤖", label: "ROBOT"   },
  { view: "compete", icon: "➕", label: "COMPETE" },
  { view: "rank",    icon: "🏆", label: "RANK"    },
  { view: "hist",    icon: "📜", label: "HIST"    },
];

function BottomNav({
  view,
  setView,
  arenaConnected,
}: {
  view: AppView;
  setView: (v: AppView) => void;
  arenaConnected: boolean;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-[#05050f]/95 backdrop-blur border-t border-gray-900 flex">
      {TABS.map((t) => (
        <button
          key={t.view}
          onClick={() => setView(t.view)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
            view === t.view
              ? "text-purple-400"
              : "text-gray-700 hover:text-gray-500"
          }`}
        >
          <span className="text-base leading-none relative">
            {t.icon}
            {t.view === "arena" && arenaConnected && (
              <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-live-blink" />
            )}
          </span>
          <span className={`text-[7px] font-bold tracking-[0.15em] ${view === t.view ? "text-purple-400" : "text-gray-700"}`}>
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ── Arena content ─────────────────────────────────────────────────────────────
function ArenaContent({
  arenaId,
  connected,
  lastEvent,
}: {
  arenaId: number;
  connected: boolean;
  lastEvent: ReturnType<typeof useArenaSocket>["lastEvent"];
}) {
  const [match, setMatch]               = useState<MatchState>({ ...DEFAULT_STATE, arenaId });
  const [commentary, setCommentary]     = useState<string[]>(["Welcome to Proof of Battle.", "On-chain arena initialized. Awaiting combat..."]);
  const [lastAudio, setLastAudio]       = useState<string | undefined>();
  const [posA, setPosA]                 = useState({ x: -1.2, y: 0 });
  const [posB, setPosB]                 = useState({ x:  1.2, y: 0 });
  const [txLog, setTxLog]               = useState<string[]>([]);
  const [bets, setBets]                 = useState({ a: 0, b: 0 });
  const [nameA, setNameA]               = useState("UNIT ALPHA");
  const [nameB, setNameB]               = useState("UNIT BETA");
  const [statsA, setStatsA]             = useState<{ atk: number; def: number; spd: number } | null>(null);
  const [statsB, setStatsB]             = useState<{ atk: number; def: number; spd: number } | null>(null);
  const [profileA, setProfileA]         = useState<{ wins: number; losses: number; categories: string[] } | null>(null);
  const [profileB, setProfileB]         = useState<{ wins: number; losses: number; categories: string[] } | null>(null);
  const [shareCopied, setShareCopied]   = useState(false);
  const [chainBattle, setChainBattle]   = useState<BattleOnChainState | null>(null);

  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { robot: myRobot } = useRobot(publicKey);

  // Which side (if any) the connected wallet is the registered owner of —
  // drives whether this client sees voice commands (competitor) or just betting (spectator).
  const isCommanderA = !!myRobot && !!chainBattle && myRobot.pda === chainBattle.robotA;
  const isCommanderB = !!myRobot && !!chainBattle && myRobot.pda === chainBattle.robotB;
  const isSpectator  = !!publicKey && !isCommanderA && !isCommanderB;

  useEffect(() => {
    let cancelled = false;
    fetchBattleOnChain(connection, arenaId)
      .then((b) => { if (!cancelled) setChainBattle(b); })
      .catch(() => { if (!cancelled) setChainBattle(null); });
    return () => { cancelled = true; };
  }, [connection, arenaId]);

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?arena=${arenaId}`;
    if (navigator.share) {
      navigator.share({ title: `Battle #${arenaId} · Proof of Battle`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    setMatch({ ...DEFAULT_STATE, arenaId });
    setStatsA(null);
    setStatsB(null);
    setProfileA(null);
    setProfileB(null);

    let rNameA = "UNIT ALPHA";
    let rNameB = "UNIT BETA";

    fetch(`${BRIDGE_HTTP}/api/competition/${arenaId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (data.robot_a_name) { setNameA(data.robot_a_name); rNameA = data.robot_a_name; }
        if (data.robot_b_name) { setNameB(data.robot_b_name); rNameB = data.robot_b_name; }
        if (data.robot_a_attack != null) setStatsA({ atk: data.robot_a_attack, def: data.robot_a_defense, spd: data.robot_a_speed });
        if (data.robot_b_attack != null) setStatsB({ atk: data.robot_b_attack, def: data.robot_b_defense, spd: data.robot_b_speed });
        // Fetch W/L + categories from leaderboard
        return fetch(`${BRIDGE_HTTP}/api/leaderboard`);
      })
      .then((r) => r?.ok ? r.json() : null)
      .then((entries: Array<{ name: string; wins: number; losses: number; categories?: string[] }> | null) => {
        if (!entries) return;
        const a = entries.find((e) => e.name === rNameA);
        const b = entries.find((e) => e.name === rNameB);
        if (a) setProfileA({ wins: a.wins, losses: a.losses, categories: a.categories ?? [] });
        if (b) setProfileB({ wins: b.wins, losses: b.losses, categories: b.categories ?? [] });
      })
      .catch(() => {});
  }, [arenaId]);

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
    <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4 flex flex-col gap-4 pb-24">
      <div className="flex justify-end">
        <button
          onClick={handleShare}
          className="text-[9px] font-mono text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-3 py-1.5 transition-colors tracking-widest flex items-center gap-1.5"
        >
          {shareCopied ? "✓ COPIED" : "⤴ SHARE"}
        </button>
      </div>
      {isFinished && match.winner && (
        <div className="border border-yellow-700/60 rounded-lg p-4 text-center bg-yellow-950/30">
          <p className="text-xs tracking-[0.3em] text-yellow-600 uppercase mb-1">Match Over</p>
          <p className="text-2xl font-black animate-winner-pulse text-yellow-300">★ WINNER ★</p>
          <p className="text-xs text-yellow-500 font-mono mt-1 truncate">{match.winner}</p>
        </div>
      )}
      <div className="bg-[#08080f] border border-gray-900 rounded-lg p-3 flex flex-col gap-2">
        <HealthBar hp={match.hpA} label={nameA} side="a" />
        <div className="flex items-center gap-2 py-0.5">
          <div className="flex-1 h-px bg-gradient-to-r from-blue-900/60 to-transparent" />
          <span className="text-[10px] font-black tracking-[0.4em] text-gray-600">VS</span>
          <div className="flex-1 h-px bg-gradient-to-l from-red-900/60 to-transparent" />
        </div>
        <HealthBar hp={match.hpB} label={nameB} side="b" flip />
      </div>
      {(statsA || statsB) && (
        <div className="bg-[#08080f] border border-gray-900 rounded-lg p-3 flex flex-col gap-2.5">
          <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase">Combat Specs</p>

          {/* Robot names + W/L record */}
          <div className="flex items-start justify-between gap-2">
            {/* Robot A */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] font-black text-blue-300 truncate">{nameA}</span>
              {profileA && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-green-500">{profileA.wins}W</span>
                  <span className="text-[8px] font-mono text-red-500">{profileA.losses}L</span>
                  {profileA.wins + profileA.losses > 0 && (
                    <span className="text-[8px] font-mono text-gray-600">
                      {Math.round((profileA.wins / (profileA.wins + profileA.losses)) * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono text-gray-700 self-center flex-shrink-0">VS</span>
            {/* Robot B */}
            <div className="flex flex-col gap-0.5 items-end min-w-0">
              <span className="text-[10px] font-black text-red-300 truncate">{nameB}</span>
              {profileB && (
                <div className="flex items-center gap-1.5">
                  {profileB.wins + profileB.losses > 0 && (
                    <span className="text-[8px] font-mono text-gray-600">
                      {Math.round((profileB.wins / (profileB.wins + profileB.losses)) * 100)}%
                    </span>
                  )}
                  <span className="text-[8px] font-mono text-green-500">{profileB.wins}W</span>
                  <span className="text-[8px] font-mono text-red-500">{profileB.losses}L</span>
                </div>
              )}
            </div>
          </div>

          {/* Stat bars */}
          {(["atk", "def", "spd"] as const).map((key) => {
            const colors = { atk: "#ef4444", def: "#3b82f6", spd: "#22c55e" };
            const labels = { atk: "ATK", def: "DEF", spd: "SPD" };
            const vA = statsA?.[key] ?? 0;
            const vB = statsB?.[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold w-7 text-right tabular-nums" style={{ color: colors[key] }}>{vA}</span>
                <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden flex justify-end">
                  <div className="h-full rounded-full" style={{ width: `${vA}%`, backgroundColor: colors[key], opacity: 0.8 }} />
                </div>
                <span className="text-[8px] font-mono text-gray-600 w-6 text-center">{labels[key]}</span>
                <div className="flex-1 h-1.5 bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${vB}%`, backgroundColor: colors[key], opacity: 0.5 }} />
                </div>
                <span className="text-[10px] font-mono font-bold w-7 tabular-nums" style={{ color: colors[key], opacity: 0.7 }}>{vB}</span>
              </div>
            );
          })}

          {/* Categories */}
          {(profileA?.categories?.length || profileB?.categories?.length) ? (
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-gray-900/60">
              <div className="flex flex-wrap gap-1 flex-1">
                {(profileA?.categories ?? []).map((cat) => (
                  <span key={cat} className="text-[7px] font-mono border border-blue-900/50 text-blue-500 bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                    {cat}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 flex-1 justify-end">
                {(profileB?.categories ?? []).map((cat) => (
                  <span key={cat} className="text-[7px] font-mono border border-red-900/50 text-red-500 bg-red-950/30 px-1.5 py-0.5 rounded-full">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="bg-[#08080f] border border-gray-900 rounded-lg p-2">
        <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase px-1 pb-1">
          Top-down view · Real-time
        </p>
        <Arena posA={posA} posB={posB} hpA={match.hpA} hpB={match.hpB} />
      </div>
      <BettingPanel arenaId={arenaId} totalBetsA={bets.a} totalBetsB={bets.b} isFinished={isFinished} nameA={nameA} nameB={nameB} />
      <Commentary lines={commentary} audioBase64={lastAudio} />
      {(isCommanderA || isCommanderB) ? (
        <div className={`grid ${isCommanderA && isCommanderB ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
          {isCommanderA && <VoiceControl arenaId={arenaId} robotId="robot_a" />}
          {isCommanderB && <VoiceControl arenaId={arenaId} robotId="robot_b" />}
        </div>
      ) : isSpectator ? (
        <div className="border border-gray-900 rounded-lg p-3 text-center bg-[#08080f]">
          <p className="text-[9px] text-gray-600 font-mono">Spectating — only the robot owner's wallet can send voice commands</p>
        </div>
      ) : null}
      {txLog.length > 0 && (
        <div className="border border-gray-900 rounded-lg p-2.5 bg-[#08080f]">
          <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase mb-1.5">On-chain log</p>
          {txLog.map((tx, i) => (
            <p key={i} className="text-[10px] font-mono text-green-700 leading-5">{tx}</p>
          ))}
        </div>
      )}
      {!connected && (
        <div className="border border-gray-900 rounded-lg p-3 text-center bg-[#08080f]">
          <p className="text-[9px] text-gray-600 font-mono">Bridge offline — waiting for arena connection</p>
        </div>
      )}
    </main>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [landed, setLanded] = useState(false);
  const [view, setView]     = useState<AppView>("live");
  const [activeArenaId, setActiveArenaId] = useState(DEFAULT_ARENA_ID);

  const { connected, lastEvent } = useArenaSocket(activeArenaId);

  const handleJoin = (battleId: number) => {
    setActiveArenaId(battleId);
    setView("arena");
  };

  const handleCompetitionCreated = (battleId: number) => {
    setActiveArenaId(battleId);
    setView("live");
  };

  if (!landed) return <Landing onEnter={() => setLanded(true)} />;

  return (
    <div className="min-h-dvh bg-[#05050f] text-white font-mono flex flex-col"
         style={{ animation: "fade-up 0.4s ease-out both" }}>

      {/* ── HEADER */}
      <header className="sticky top-0 z-10 bg-[#05050f]/90 backdrop-blur border-b border-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RobotLogo size={28} />
          <div>
            <h1 className="text-base font-black tracking-[0.15em] text-glow-white">
              ⚔ PROOF OF BATTLE
            </h1>
            <p className="text-[9px] text-gray-600 tracking-[0.2em] uppercase mt-0.5">
              {view === "arena"   ? `Arena #${activeArenaId}`
               : view === "live"    ? "Live Streams"
               : view === "robot"   ? "Robot Registration"
               : view === "rank"    ? "Rankings"
               : view === "hist"    ? "My Battles"
               : "Create Competition"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <WalletButton />
          {view === "arena" && (
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-live-blink" : "bg-gray-700"}`} />
              <span className={`text-[9px] font-bold tracking-widest ${connected ? "text-green-400" : "text-gray-600"}`}>
                {connected ? "LIVE" : "OFFLINE"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── CONTENT */}
      <div className="flex-1 overflow-y-auto">
        {view === "live"    && <StreamBrowser onJoin={handleJoin} />}
        {view === "rank"    && <Leaderboard />}
        {view === "arena"   && (
          <ArenaContent
            arenaId={activeArenaId}
            connected={connected}
            lastEvent={lastEvent}
          />
        )}
        {view === "robot"   && <RobotRegister />}
        {view === "compete" && <CreateCompetition onCreated={handleCompetitionCreated} />}
        {view === "hist"    && <History onJoin={handleJoin} />}
      </div>

      {/* ── FOOTER TAGLINE (hidden behind nav) */}
      <div className="h-16" aria-hidden />

      {/* ── BOTTOM NAV */}
      <BottomNav view={view} setView={setView} arenaConnected={connected} />
    </div>
  );
}
