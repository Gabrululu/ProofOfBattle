import { useState, useEffect, useRef, useCallback } from "react";
import { fetchBattleState } from "../lib/program";
import { BRIDGE_WS_BASE } from "../lib/constants";

export interface BattleEvent {
  id: string;
  text: string;
  kind: "damage" | "action" | "system" | "result";
  ts: number;
}

export interface BattleState {
  hpA: number;
  hpB: number;
  status: number;       // 0=Waiting 1=Active 2=Finished
  totalBackA: number;
  totalBackB: number;
  totalBackAUsdc: number;
  totalBackBUsdc: number;
  winner: number;       // 255 = no winner
  events: BattleEvent[];
  robotA: string;
  robotB: string;
}

const DEFAULT_STATE: BattleState = {
  hpA: 100,
  hpB: 100,
  status: 0,
  totalBackA: 0,
  totalBackB: 0,
  totalBackAUsdc: 0,
  totalBackBUsdc: 0,
  winner: 255,
  events: [],
  robotA: "",
  robotB: "",
};

const MAX_EVENTS = 30;

let _evtSeq = 0;
function makeEvent(text: string, kind: BattleEvent["kind"]): BattleEvent {
  return { id: String(++_evtSeq), text, kind, ts: Date.now() };
}

function pushEvent(prev: BattleState, evt: BattleEvent): BattleState {
  const events = [evt, ...prev.events].slice(0, MAX_EVENTS);
  return { ...prev, events };
}

export function useBattle(battleId: number) {
  const [battle, setBattle] = useState<BattleState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const deadRef = useRef(false);

  // ── Devnet poll (source of truth for HP / status / bets) ──────────────────
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const state = await fetchBattleState(battleId);
        if (state && mounted) {
          setBattle((prev) => ({
            ...prev,
            hpA: state.hpA,
            hpB: state.hpB,
            status: state.status,
            totalBackA: state.totalBackA,
            totalBackB: state.totalBackB,
            totalBackAUsdc: state.totalBackAUsdc,
            totalBackBUsdc: state.totalBackBUsdc,
            winner: state.winner,
            robotA: state.robotA,
            robotB: state.robotB,
          }));
        }
      } catch {
        // keep last known state
      } finally {
        if (mounted) setLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { mounted = false; clearInterval(interval); };
  }, [battleId]);

  // ── WebSocket: real-time events from bridge ────────────────────────────────
  const connectWs = useCallback(() => {
    if (deadRef.current) return;

    const url = `${BRIDGE_WS_BASE}/ws/arena/${battleId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setBattle((prev) =>
        pushEvent(prev, makeEvent("Connected — receiving live events", "system"))
      );
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (!deadRef.current) {
        setBattle((prev) =>
          pushEvent(prev, makeEvent("Connection lost — reconnecting…", "system"))
        );
        setTimeout(connectWs, 3000);
      }
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string);

        if (event.type === "damage") {
          const attacker = event.attacker === "robot_a" ? "UNIT-A" : "UNIT-B";
          const target   = event.target   === "robot_a" ? "UNIT-A" : "UNIT-B";
          setBattle((prev) => pushEvent(
            {
              ...prev,
              hpA: event.hp_a ?? prev.hpA,
              hpB: event.hp_b ?? prev.hpB,
            },
            makeEvent(`${attacker} → ${target}  -${event.damage} HP`, "damage")
          ));
        }

        if (event.type === "robot_action") {
          const unit = event.robot_id === "robot_a" ? "UNIT-A" : "UNIT-B";
          const action = typeof event.action === "object"
            ? (event.action?.type ?? JSON.stringify(event.action))
            : String(event.action);
          setBattle((prev) =>
            pushEvent(prev, makeEvent(`${unit}: ${action.toUpperCase()}`, "action"))
          );
        }

        if (event.type === "sensor_update") {
          const d = event.data ?? event;
          const a = d.robot_a;
          const b = d.robot_b;
          if (a?.hp !== undefined && b?.hp !== undefined) {
            setBattle((prev) => ({
              ...prev,
              hpA: a.hp,
              hpB: b.hp,
            }));
          }
        }

        if (event.type === "match_over") {
          const side = event.winner === 0 ? "A" : "B";
          setBattle((prev) => pushEvent(
            { ...prev, status: 2, winner: event.winner ?? 255 },
            makeEvent(`★ UNIT-${side} WINS THE BATTLE`, "result")
          ));
        }
      } catch { /* ignore malformed */ }
    };
  }, [battleId]);

  useEffect(() => {
    deadRef.current = false;
    connectWs();
    return () => {
      deadRef.current = true;
      wsRef.current?.close();
    };
  }, [connectWs]);

  return { battle, loading, wsConnected };
}
