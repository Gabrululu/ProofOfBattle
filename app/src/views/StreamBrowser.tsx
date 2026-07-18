import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { CompetitionMeta } from "../types";

const BRIDGE_HTTP = (import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000").replace(
  /^wss?/,
  (m: string) => (m === "wss" ? "https" : "http")
);

interface Props {
  onJoin: (battleId: number) => void;
}

type RawCompetition = {
  battle_id: number;
  name: string;
  location: string;
  creator?: string;
  is_team: boolean;
  team_name?: string;
  members?: { wallet: string; alias: string; share: number }[];
  status: string;
  viewer_count: number;
};

function toMeta(c: RawCompetition): CompetitionMeta {
  return {
    battleId: c.battle_id,
    name: c.name,
    location: c.location,
    creator: c.creator ?? "",
    isTeam: c.is_team,
    teamName: c.team_name,
    members: c.members,
    status: c.status as CompetitionMeta["status"],
    viewerCount: c.viewer_count,
  };
}

const STATUS_BADGE: Record<
  string,
  { label: string; cls: string }
> = {
  active:   { label: "● LIVE",    cls: "border-green-800 text-green-400 bg-green-950/40" },
  waiting:  { label: "◎ WAITING", cls: "border-yellow-800 text-yellow-400 bg-yellow-950/40" },
  finished: { label: "○ ENDED",   cls: "border-gray-800 text-gray-500 bg-gray-900/40" },
};

type Filter = "all" | "active" | "waiting" | "finished";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",      label: "ALL"     },
  { key: "active",   label: "● LIVE"  },
  { key: "waiting",  label: "◎ WAIT"  },
  { key: "finished", label: "○ ENDED" },
];

export function StreamBrowser({ onJoin }: Props) {
  const { publicKey } = useWallet();
  const [competitions, setCompetitions] = useState<CompetitionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<number | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [startError, setStartError] = useState<{ id: number; msg: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [notifGranted, setNotifGranted] = useState(false);
  const prevStatusRef = useRef<Map<number, string> | null>(null);

  const fetchCompetitions = useCallback(async () => {
    try {
      const resp = await fetch(`${BRIDGE_HTTP}/api/competitions`);
      if (resp.ok) {
        const data: RawCompetition[] = await resp.json();
        setCompetitions(data.map(toMeta));
      }
    } catch {
      /* bridge offline — keep whatever we have */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompetitions();
    const id = setInterval(fetchCompetitions, 5000);
    return () => clearInterval(id);
  }, [fetchCompetitions]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setNotifGranted(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    if (prevStatusRef.current === null) {
      const m = new Map<number, string>();
      competitions.forEach((c) => m.set(c.battleId, c.status));
      prevStatusRef.current = m;
      return;
    }
    const m = new Map<number, string>();
    competitions.forEach((c) => {
      const prev = prevStatusRef.current!.get(c.battleId);
      if (prev === "waiting" && c.status === "active" && Notification.permission === "granted") {
        new Notification("⚔ Battle Started!", { body: `${c.name} is now LIVE!` });
      }
      m.set(c.battleId, c.status);
    });
    prevStatusRef.current = m;
  }, [competitions]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifGranted(perm === "granted");
  };

  const handleJoin = (battleId: number) => {
    setJoining(battleId);
    setTimeout(() => {
      onJoin(battleId);
      setJoining(null);
    }, 280);
  };

  const handleStart = async (battleId: number) => {
    if (!publicKey) return;
    setStarting(battleId);
    setStartError(null);
    try {
      const resp = await fetch(
        `${BRIDGE_HTTP}/api/competition/${battleId}/start?creator=${publicKey.toBase58()}`,
        { method: "POST" }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setStartError({ id: battleId, msg: data.detail ?? data.error ?? "Start failed" });
      } else {
        await fetchCompetitions();
      }
    } catch {
      setStartError({ id: battleId, msg: "Bridge unreachable" });
    } finally {
      setStarting(null);
    }
  };

  const counts = {
    all:      competitions.length,
    active:   competitions.filter((c) => c.status === "active").length,
    waiting:  competitions.filter((c) => c.status === "waiting").length,
    finished: competitions.filter((c) => c.status === "finished").length,
  };
  const visible = filter === "all" ? competitions : competitions.filter((c) => c.status === filter);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black tracking-[0.3em] text-gray-200 uppercase">
            Live Streams
          </h2>
          <p className="text-[9px] text-gray-600 tracking-wider mt-0.5">
            Join a competition and support your favorite
          </p>
        </div>
        <div className="flex items-center gap-2">
          {"Notification" in window && !notifGranted && (
            <button
              onClick={enableNotifications}
              className="text-[8px] font-mono text-yellow-700 hover:text-yellow-500 border border-yellow-900/60 rounded-lg px-2.5 py-1.5 transition-colors tracking-widest"
              title="Get notified when battles go live"
            >
              🔔 ALERTS
            </button>
          )}
          {notifGranted && (
            <span className="text-[8px] font-mono text-green-700 tracking-widest">🔔 ON</span>
          )}
          <button
            onClick={fetchCompetitions}
            className="text-[8px] font-mono text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-2.5 py-1.5 transition-colors tracking-widest"
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ key, label }) => {
          const count = counts[key];
          const active = filter === key;
          const clr =
            key === "active"   ? "border-green-800 text-green-400 bg-green-950/50"  :
            key === "waiting"  ? "border-yellow-800 text-yellow-400 bg-yellow-950/50" :
            key === "finished" ? "border-gray-700 text-gray-500 bg-gray-900/50"     :
            "border-gray-700 text-gray-400 bg-gray-900/30";
          const inactiveClr = "border-gray-900 text-gray-600 bg-transparent hover:border-gray-800 hover:text-gray-500";
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-mono font-bold border transition-all ${
                active ? clr : inactiveClr
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[8px] tabular-nums ${active ? "opacity-80" : "opacity-40"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <p className="text-[10px] text-gray-600 font-mono animate-pulse">
            SCANNING ARENA…
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="text-4xl opacity-20">⚔</span>
          <p className="text-[10px] text-gray-600 font-mono tracking-widest">
            {competitions.length === 0 ? "NO ACTIVE COMPETITIONS" : `NO ${filter.toUpperCase()} COMPETITIONS`}
          </p>
          {competitions.length === 0 && (
            <p className="text-[9px] text-gray-700 text-center max-w-xs">
              Be the first — open the COMPETE tab to create a competition and
              start streaming.
            </p>
          )}
          {competitions.length > 0 && filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="text-[9px] font-mono text-purple-500 hover:text-purple-400 transition-colors"
            >
              Show all {competitions.length} competitions →
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.waiting;
            const canJoin = c.status !== "finished";

            return (
              <div
                key={c.battleId}
                className="bg-[#08080f] border border-gray-900 rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-gray-800"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[11px] font-black text-gray-100 tracking-wider truncate">
                        {c.name}
                      </h3>
                      {c.isTeam && (
                        <span className="text-[7px] font-mono font-bold border border-purple-800 text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-full flex-shrink-0">
                          TEAM
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[8px] text-gray-600 font-mono flex-wrap">
                      <span>📍 {c.location}</span>
                      {c.viewerCount > 0 && (
                        <span className="text-gray-700">
                          · 👁 {c.viewerCount}
                        </span>
                      )}
                      <span className="text-gray-800">
                        · ID {c.battleId}
                      </span>
                    </div>
                    {c.isTeam && c.teamName && (
                      <p className="text-[8px] text-purple-500 font-mono">
                        {c.teamName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 text-[8px] font-bold font-mono border px-2.5 py-1 rounded-full ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Team members */}
                {c.isTeam &&
                  c.members &&
                  c.members.some((m) => m.alias || m.wallet) && (
                    <div className="flex flex-wrap gap-1.5 border-t border-gray-900/80 pt-2.5">
                      {c.members
                        .filter((m) => m.alias || m.wallet)
                        .map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-[8px] bg-[#0c0c1a] border border-gray-800 rounded-full px-2.5 py-1"
                          >
                            <span className="text-gray-400 font-mono">
                              {m.alias ||
                                (m.wallet
                                  ? m.wallet.slice(0, 4) + "…" + m.wallet.slice(-4)
                                  : "?")}
                            </span>
                            <span className="text-yellow-600 font-mono">
                              {m.share}%
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                {/* Creator: start battle */}
                {publicKey?.toBase58() === c.creator && c.status === "waiting" && (
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleStart(c.battleId)}
                      disabled={starting === c.battleId}
                      className={`w-full py-2.5 rounded-lg font-black text-[10px] tracking-[0.2em] transition-all border border-red-700/70 bg-red-900/30 hover:bg-red-900/50 text-red-300 ${
                        starting === c.battleId ? "opacity-50 cursor-wait" : ""
                      }`}
                    >
                      {starting === c.battleId ? "◌ INICIANDO…" : "⚔ INICIAR BATALLA"}
                    </button>
                    {startError?.id === c.battleId && (
                      <p className="text-[8px] text-red-500 font-mono text-center">
                        {startError.msg}
                      </p>
                    )}
                  </div>
                )}

                {/* Join button */}
                <button
                  onClick={() => handleJoin(c.battleId)}
                  disabled={!canJoin || joining === c.battleId}
                  className={`w-full py-2.5 rounded-lg font-black text-[10px] tracking-[0.25em] transition-all ${
                    !canJoin
                      ? "bg-gray-900 text-gray-600 cursor-not-allowed"
                      : c.status === "active"
                      ? "bg-green-900/40 hover:bg-green-900/60 border border-green-800/60 text-green-300"
                      : "bg-purple-900/40 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300"
                  } ${joining === c.battleId ? "opacity-50 cursor-wait" : ""}`}
                >
                  {joining === c.battleId
                    ? "◌ JOINING…"
                    : !canJoin
                    ? "ENDED"
                    : c.status === "active"
                    ? "▶ JOIN LIVE"
                    : "◎ ENTER ARENA"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
