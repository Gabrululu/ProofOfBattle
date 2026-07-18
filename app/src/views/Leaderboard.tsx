import { useState, useEffect, useCallback } from "react";

const BRIDGE_HTTP = (import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000").replace(
  /^wss?/,
  (m: string) => (m === "wss" ? "https" : "http")
);

interface RobotEntry {
  owner: string;
  name: string;
  attack: number;
  defense: number;
  speed: number;
  wins: number;
  losses: number;
  hp: number;
  is_active: boolean;
  categories?: string[];
}

const MEDAL = ["🥇", "🥈", "🥉"];

function StatBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative h-1 flex-1 bg-gray-900 rounded-full overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full rounded-full"
        style={{ width: `${value}%`, backgroundColor: color, opacity: 0.75 }}
      />
    </div>
  );
}

export function Leaderboard() {
  const [entries, setEntries] = useState<RobotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const resp = await fetch(`${BRIDGE_HTTP}/api/leaderboard`);
      if (resp.ok) {
        setEntries(await resp.json());
        setLastUpdate(new Date());
      }
    } catch {
      /* bridge offline */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 15_000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black tracking-[0.3em] text-gray-200 uppercase">
            Leaderboard
          </h2>
          <p className="text-[9px] text-gray-600 tracking-wider mt-0.5">
            {lastUpdate
              ? `Updated ${lastUpdate.toLocaleTimeString()}`
              : "Robot rankings by wins"}
          </p>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="text-[8px] font-mono text-gray-600 hover:text-gray-400 border border-gray-800 rounded-lg px-2.5 py-1.5 transition-colors tracking-widest"
        >
          ↻ REFRESH
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[10px] text-gray-600 font-mono animate-pulse">
            LOADING RANKINGS…
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="text-4xl opacity-20">🏆</span>
          <p className="text-[10px] text-gray-600 font-mono tracking-widest">
            NO ROBOTS REGISTERED
          </p>
          <p className="text-[9px] text-gray-700 text-center max-w-xs">
            Register your robot in the ROBOT tab to appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e, idx) => {
            const winRate = e.wins + e.losses > 0
              ? Math.round((e.wins / (e.wins + e.losses)) * 100)
              : 0;

            return (
              <div
                key={e.owner}
                className={`bg-[#08080f] border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
                  idx === 0
                    ? "border-yellow-800/60"
                    : idx === 1
                    ? "border-gray-600/40"
                    : idx === 2
                    ? "border-orange-900/40"
                    : "border-gray-900"
                }`}
              >
                {/* Rank + name row */}
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center flex-shrink-0">
                    {MEDAL[idx] ?? (
                      <span className="text-[11px] font-mono text-gray-600">
                        #{idx + 1}
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[12px] font-black text-gray-100 tracking-wider truncate">
                        {e.name}
                      </p>
                      {e.is_active && (
                        <span className="text-[7px] font-mono font-bold border border-green-800 text-green-400 bg-green-950/40 px-2 py-0.5 rounded-full flex-shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] text-gray-700 font-mono truncate">
                      {e.owner.slice(0, 8)}…{e.owner.slice(-8)}
                    </p>
                  </div>

                  {/* W/L */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-green-400 font-mono">
                        {e.wins}W
                      </span>
                      <span className="text-[10px] font-black text-red-400 font-mono">
                        {e.losses}L
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-gray-600">
                      {winRate}% win rate
                    </span>
                  </div>
                </div>

                {/* Stats bars */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-gray-600 w-6">ATK</span>
                    <StatBar value={e.attack}  color="#ef4444" />
                    <span className="text-[9px] font-mono text-red-400 w-6 text-right">{e.attack}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-gray-600 w-6">DEF</span>
                    <StatBar value={e.defense} color="#3b82f6" />
                    <span className="text-[9px] font-mono text-blue-400 w-6 text-right">{e.defense}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-gray-600 w-6">SPD</span>
                    <StatBar value={e.speed}   color="#22c55e" />
                    <span className="text-[9px] font-mono text-green-400 w-6 text-right">{e.speed}</span>
                  </div>
                </div>

                {/* Categories */}
                {e.categories && e.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {e.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[7px] font-mono border border-purple-900/60 text-purple-500 bg-purple-950/30 px-2 py-0.5 rounded-full"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
