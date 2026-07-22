import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { BRIDGE_HTTP_URL as BRIDGE_HTTP } from "./lib/bridge";
import { MatchState, DamageEvent, SensorUpdate, AppView } from "./types";
import { RobotRegister } from "./views/RobotRegister";
import { CreateCompetition } from "./views/CreateCompetition";
import { StreamBrowser } from "./views/StreamBrowser";
import { Leaderboard } from "./views/Leaderboard";
import { History } from "./views/History";

const DEFAULT_ARENA_ID = 1;

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
      <rect x="1"  y="10"   width="5" height="2" rx="1" fill="#2D7BFF" opacity="0.9"/>
      <rect x="1"  y="14.5" width="5" height="2" rx="1" fill="#2D7BFF" opacity="0.6"/>
      <rect x="1"  y="19"   width="5" height="2" rx="1" fill="#2D7BFF" opacity="0.4"/>
      <rect x="26" y="10"   width="5" height="2" rx="1" fill="#FF2D4A" opacity="0.9"/>
      <rect x="26" y="14.5" width="5" height="2" rx="1" fill="#FF2D4A" opacity="0.6"/>
      <rect x="26" y="19"   width="5" height="2" rx="1" fill="#FF2D4A" opacity="0.4"/>
      <rect x="11" y="1"    width="2" height="5" rx="1" fill="#6EA8FF" opacity="0.7"/>
      <rect x="15" y="1"    width="2" height="5" rx="1" fill="#6EA8FF" opacity="0.5"/>
      <rect x="19" y="1"    width="2" height="5" rx="1" fill="#6EA8FF" opacity="0.3"/>
      <rect x="11" y="26"   width="2" height="5" rx="1" fill="#6EA8FF" opacity="0.3"/>
      <rect x="15" y="26"   width="2" height="5" rx="1" fill="#6EA8FF" opacity="0.5"/>
      <rect x="19" y="26"   width="2" height="5" rx="1" fill="#6EA8FF" opacity="0.7"/>
      <rect x="6"  y="6"    width="20" height="20" rx="3" fill="#0f172a" stroke="#1e3a5f" strokeWidth="1"/>
      <rect x="8"  y="11"   width="6" height="4" rx="1.5" fill="#2D7BFF"/>
      <rect x="9"  y="12"   width="2" height="2" rx="0.5" fill="#93c5fd" opacity="0.8"/>
      <rect x="18" y="11"   width="6" height="4" rx="1.5" fill="#FF2D4A"/>
      <rect x="19" y="12"   width="2" height="2" rx="0.5" fill="#fca5a5" opacity="0.8"/>
      <rect x="9"  y="19"   width="14" height="1.5" rx="0.5" fill="#1e3a5f"/>
      <rect x="11" y="19"   width="2"  height="1.5" fill="#2D7BFF" opacity="0.6"/>
      <rect x="15" y="19"   width="2"  height="1.5" fill="#6EA8FF" opacity="0.6"/>
      <rect x="19" y="19"   width="2"  height="1.5" fill="#FF2D4A" opacity="0.6"/>
    </svg>
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border flex">
      {TABS.map((t) => (
        <button
          key={t.view}
          onClick={() => setView(t.view)}
          className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors ${
            view === t.view
              ? "text-primary"
              : "text-muted hover:text-foreground"
          }`}
        >
          <span className="text-base leading-none relative">
            {t.icon}
            {t.view === "arena" && arenaConnected && (
              <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-live-blink" />
            )}
          </span>
          <span className={`text-[7px] font-bold tracking-[0.15em] ${view === t.view ? "text-primary" : "text-muted"}`}>
            {t.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ── Desktop sidebar nav ────────────────────────────────────────────────────────
function SidebarNav({
  view,
  setView,
  arenaConnected,
}: {
  view: AppView;
  setView: (v: AppView) => void;
  arenaConnected: boolean;
}) {
  return (
    <nav className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:border-r md:border-border md:py-6 md:px-3 md:gap-1">
      {TABS.map((t) => (
        <button
          key={t.view}
          onClick={() => setView(t.view)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
            view === t.view
              ? "bg-primary/15 text-primary"
              : "text-muted hover:bg-white/[0.03] hover:text-foreground"
          }`}
        >
          <span className="text-base leading-none relative">
            {t.icon}
            {t.view === "arena" && arenaConnected && (
              <span className="absolute -top-0.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-live-blink" />
            )}
          </span>
          <span className="text-[11px] font-bold tracking-[0.15em]">{t.label}</span>
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
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-4 md:py-6 flex flex-col gap-4 pb-24 md:pb-6">
      <div className="flex justify-end">
        <button
          onClick={handleShare}
          className="text-[9px] font-mono text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors tracking-widest flex items-center gap-1.5"
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

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
        {/* LEFT — health, specs, top-down view */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-2">
            <HealthBar hp={match.hpA} label={nameA} side="a" />
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 h-px bg-gradient-to-r from-secondary/40 to-transparent" />
              <span className="text-[10px] font-black tracking-[0.4em] text-muted">VS</span>
              <div className="flex-1 h-px bg-gradient-to-l from-primary/40 to-transparent" />
            </div>
            <HealthBar hp={match.hpB} label={nameB} side="b" flip />
          </div>
          {(statsA || statsB) && (
            <div className="bg-surface border border-border rounded-lg p-3 flex flex-col gap-2.5">
              <p className="text-[8px] tracking-[0.3em] text-muted uppercase">Combat Specs</p>

              {/* Robot names + W/L record */}
              <div className="flex items-start justify-between gap-2">
                {/* Robot A */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-black text-secondary truncate">{nameA}</span>
                  {profileA && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-mono text-green-500">{profileA.wins}W</span>
                      <span className="text-[8px] font-mono text-red-500">{profileA.losses}L</span>
                      {profileA.wins + profileA.losses > 0 && (
                        <span className="text-[8px] font-mono text-muted">
                          {Math.round((profileA.wins / (profileA.wins + profileA.losses)) * 100)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-mono text-muted self-center flex-shrink-0">VS</span>
                {/* Robot B */}
                <div className="flex flex-col gap-0.5 items-end min-w-0">
                  <span className="text-[10px] font-black text-primary truncate">{nameB}</span>
                  {profileB && (
                    <div className="flex items-center gap-1.5">
                      {profileB.wins + profileB.losses > 0 && (
                        <span className="text-[8px] font-mono text-muted">
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
                const colors = { atk: "var(--color-primary)", def: "var(--color-secondary)", spd: "#FBBF24" };
                const labels = { atk: "ATK", def: "DEF", spd: "SPD" };
                const vA = statsA?.[key] ?? 0;
                const vB = statsB?.[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold w-7 text-right tabular-nums" style={{ color: colors[key] }}>{vA}</span>
                    <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden flex justify-end">
                      <div className="h-full rounded-full" style={{ width: `${vA}%`, backgroundColor: colors[key], opacity: 0.8 }} />
                    </div>
                    <span className="text-[8px] font-mono text-muted w-6 text-center">{labels[key]}</span>
                    <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${vB}%`, backgroundColor: colors[key], opacity: 0.5 }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold w-7 tabular-nums" style={{ color: colors[key], opacity: 0.7 }}>{vB}</span>
                  </div>
                );
              })}

              {/* Categories */}
              {(profileA?.categories?.length || profileB?.categories?.length) ? (
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex flex-wrap gap-1 flex-1">
                    {(profileA?.categories ?? []).map((cat) => (
                      <span key={cat} className="text-[7px] font-mono border border-secondary/50 text-secondary bg-secondary/15 px-1.5 py-0.5 rounded-full">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 flex-1 justify-end">
                    {(profileB?.categories ?? []).map((cat) => (
                      <span key={cat} className="text-[7px] font-mono border border-primary/50 text-primary bg-primary/15 px-1.5 py-0.5 rounded-full">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="bg-surface border border-border rounded-lg p-2">
            <p className="text-[8px] tracking-[0.3em] text-muted uppercase px-1 pb-1">
              Top-down view · Real-time
            </p>
            <Arena posA={posA} posB={posB} hpA={match.hpA} hpB={match.hpB} />
          </div>
        </div>

        {/* RIGHT — betting, commentary, voice control, tx log */}
        <div className="flex flex-col gap-4">
          <BettingPanel arenaId={arenaId} totalBetsA={bets.a} totalBetsB={bets.b} isFinished={isFinished} nameA={nameA} nameB={nameB} />
          <Commentary lines={commentary} audioBase64={lastAudio} />
          {(isCommanderA || isCommanderB) ? (
            <div className={`grid ${isCommanderA && isCommanderB ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
              {isCommanderA && <VoiceControl arenaId={arenaId} robotId="robot_a" />}
              {isCommanderB && <VoiceControl arenaId={arenaId} robotId="robot_b" />}
            </div>
          ) : isSpectator ? (
            <div className="border border-border rounded-lg p-3 text-center bg-surface">
              <p className="text-[9px] text-muted font-mono">Spectating — only the robot owner's wallet can send voice commands</p>
            </div>
          ) : null}
          {txLog.length > 0 && (
            <div className="border border-border rounded-lg p-2.5 bg-surface">
              <p className="text-[8px] tracking-[0.3em] text-muted uppercase mb-1.5">On-chain log</p>
              {txLog.map((tx, i) => (
                <p key={i} className="text-[10px] font-mono text-green-700 leading-5">{tx}</p>
              ))}
            </div>
          )}
          {!connected && (
            <div className="border border-border rounded-lg p-3 text-center bg-surface">
              <p className="text-[9px] text-muted font-mono">Bridge offline — waiting for arena connection</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
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

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans flex flex-col"
         style={{ animation: "fade-up 0.4s ease-out both" }}>

      {/* ── HEADER */}
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-4 md:px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group" title="Back to homepage">
          <span className="transition-transform group-hover:scale-105">
            <RobotLogo size={28} />
          </span>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-[0.15em] text-glow-white group-hover:text-primary transition-colors">
              ⚔ PROOF OF BATTLE
            </h1>
            <p className="text-[9px] text-muted tracking-[0.2em] uppercase mt-0.5 font-mono">
              {view === "arena"   ? `Arena #${activeArenaId}`
               : view === "live"    ? "Live Streams"
               : view === "robot"   ? "Robot Registration"
               : view === "rank"    ? "Rankings"
               : view === "hist"    ? "My Battles"
               : "Create Competition"}
            </p>
          </div>
        </Link>
        <div className="flex flex-col items-end gap-1.5">
          <WalletButton />
          {view === "arena" && (
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-live-blink" : "bg-muted"}`} />
              <span className={`text-[9px] font-bold tracking-widest ${connected ? "text-green-400" : "text-muted"}`}>
                {connected ? "LIVE" : "OFFLINE"}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── BODY: sidebar (desktop) + content */}
      <div className="flex-1 flex overflow-hidden">
        <SidebarNav view={view} setView={setView} arenaConnected={connected} />
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
      </div>

      {/* ── FOOTER TAGLINE (hidden behind mobile nav) */}
      <div className="h-16 md:hidden" aria-hidden />

      {/* ── BOTTOM NAV (mobile only) */}
      <BottomNav view={view} setView={setView} arenaConnected={connected} />
    </div>
  );
}
