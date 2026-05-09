import { useState, useEffect, useRef } from "react";
import { fetchBattleState } from "../lib/program";
import { BRIDGE_WS_BASE } from "../lib/constants";

export interface BattleState {
  hpA: number;
  hpB: number;
  status: number;       // 0=Waiting 1=Active 2=Finished
  totalBetsA: number;
  totalBetsB: number;
  winner: number;       // 255 = no winner
  lastEvent: string | null;
}

const DEFAULT_STATE: BattleState = {
  hpA: 100,
  hpB: 100,
  status: 0,
  totalBetsA: 0,
  totalBetsB: 0,
  winner: 255,
  lastEvent: null,
};

export function useBattle(battleId: number) {
  const [battle, setBattle] = useState<BattleState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Poll Devnet every 3 seconds for on-chain truth
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
            totalBetsA: state.totalBetsA,
            totalBetsB: state.totalBetsB,
            winner: state.winner,
          }));
        }
      } catch {
        // Ignore polling errors — keep last known state
      } finally {
        if (mounted) setLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [battleId]);

  // Bridge WebSocket for real-time events (bridge/main.py: /ws/arena/{id})
  useEffect(() => {
    const url = `${BRIDGE_WS_BASE}/ws/arena/${battleId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data as string);

        if (event.type === "damage") {
          // Bridge emits: { type, attacker, target, damage, hp_a, hp_b, tx }
          const attackerLabel = event.attacker === "robot_a" ? "A" : "B";
          setBattle((prev) => ({
            ...prev,
            hpA: event.hp_a ?? prev.hpA,
            hpB: event.hp_b ?? prev.hpB,
            lastEvent: `Robot ${attackerLabel} hits! -${event.damage} HP`,
          }));
        }

        if (event.type === "match_over") {
          // Bridge emits: { type, winner (0|1|null), tx }
          const winnerSide = event.winner === 0 ? "A" : "B";
          setBattle((prev) => ({
            ...prev,
            status: 2,
            winner: event.winner ?? 255,
            lastEvent: `Robot ${winnerSide} WINS!`,
          }));
        }
      } catch {
        // Malformed message — ignore
      }
    };

    ws.onerror = () => console.log("[WS] Connection failed — polling only");
    return () => ws.close();
  }, [battleId]);

  return { battle, loading };
}
