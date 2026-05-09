import { useEffect, useRef, useState, useCallback } from "react";
import { ArenaEvent } from "../types";

const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000";

export function useArenaSocket(arenaId: number) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ArenaEvent | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${BRIDGE_URL}/ws/arena/${arenaId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ArenaEvent;
        setLastEvent(event);
      } catch {}
    };

    return () => ws.close();
  }, [arenaId]);

  return { connected, lastEvent };
}

export function useSeekerSocket(arenaId: number, robotId: "robot_a" | "robot_b") {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`${BRIDGE_URL}/ws/seeker/${arenaId}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "action_dispatched") setLastAction(data.action);
    };
    return () => ws.close();
  }, [arenaId]);

  const sendVoiceText = useCallback(
    (text: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "voice_text", text, robot_id: robotId }));
      }
    },
    [robotId]
  );

  const sendVoiceAudio = useCallback(
    (audioBase64: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "voice_audio", audio: audioBase64, robot_id: robotId })
        );
      }
    },
    [robotId]
  );

  return { connected, lastAction, sendVoiceText, sendVoiceAudio };
}
