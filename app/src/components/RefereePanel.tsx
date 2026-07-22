import { useState } from "react";
import { BRIDGE_HTTP_URL as BRIDGE_HTTP } from "../lib/bridge";

interface Props {
  battleId: number;
  creator: string;
  nameA: string;
  nameB: string;
}

// Shown only to the competition's creator when mode === "physical". Reports
// damage / declares the winner via the bridge, which relays it over the same
// arena WebSocket an online (Webots-driven) battle would use.
export function RefereePanel({ battleId, creator, nameA, nameB }: Props) {
  const [damage, setDamage] = useState(10);
  const [loading, setLoading] = useState<"a" | "b" | "resolve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportHit = async (side: 0 | 1) => {
    setLoading(side === 0 ? "a" : "b");
    setError(null);
    try {
      const resp = await fetch(`${BRIDGE_HTTP}/api/competition/${battleId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator, side, damage }),
      });
      if (!resp.ok) throw new Error(`Error del bridge: ${resp.status}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo reportar el golpe");
    } finally {
      setLoading(null);
    }
  };

  const declareWinner = async (winner: 0 | 1) => {
    setLoading("resolve");
    setError(null);
    try {
      const resp = await fetch(`${BRIDGE_HTTP}/api/competition/${battleId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator, winner }),
      });
      if (!resp.ok) throw new Error(`Error del bridge: ${resp.status}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo declarar el ganador");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="border border-yellow-900/50 rounded-lg p-3 bg-yellow-950/10 flex flex-col gap-3">
      <span className="text-[9px] tracking-[0.3em] text-yellow-500 uppercase font-mono font-bold">
        Panel de árbitro
      </span>

      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono text-muted">DAÑO A REPORTAR</span>
        <input
          type="number"
          min={1}
          max={100}
          value={damage}
          onChange={(e) => setDamage(Number(e.target.value))}
          className="w-14 bg-background border border-border rounded px-2 py-1 text-[10px] font-mono text-foreground text-center"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => reportHit(0)}
          disabled={loading !== null}
          className="py-2 rounded border border-blue-800/60 bg-blue-950/20 text-blue-400 text-[9px] font-mono font-bold disabled:opacity-40"
        >
          {loading === "a" ? "◌" : `GOLPE A ${nameA}`}
        </button>
        <button
          onClick={() => reportHit(1)}
          disabled={loading !== null}
          className="py-2 rounded border border-red-800/60 bg-red-950/20 text-red-400 text-[9px] font-mono font-bold disabled:opacity-40"
        >
          {loading === "b" ? "◌" : `GOLPE A ${nameB}`}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => declareWinner(0)}
          disabled={loading !== null}
          className="py-2 rounded border border-green-800/60 bg-green-950/20 text-green-400 text-[9px] font-mono font-bold disabled:opacity-40"
        >
          {loading === "resolve" ? "◌" : `${nameA} GANA`}
        </button>
        <button
          onClick={() => declareWinner(1)}
          disabled={loading !== null}
          className="py-2 rounded border border-green-800/60 bg-green-950/20 text-green-400 text-[9px] font-mono font-bold disabled:opacity-40"
        >
          {loading === "resolve" ? "◌" : `${nameB} GANA`}
        </button>
      </div>

      {error && <p className="text-[8px] text-red-400 font-mono">{error}</p>}
    </div>
  );
}
