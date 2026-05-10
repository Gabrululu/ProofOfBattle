import { useState, useEffect, useRef, useCallback } from "react";
import { BRIDGE_WS_BASE } from "../lib/constants";

export interface SeekerEvent {
  action: string;
  command: string;
}

export function useSeekerWs(arenaId: number, robotId: "robot_a" | "robot_b") {
  const [connected, setConnected] = useState(false);
  const [lastAction, setLastAction] = useState<SeekerEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const url = `${BRIDGE_WS_BASE}/ws/seeker/${arenaId}`;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen  = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data as string);
          if (evt.type === "action_dispatched") {
            setLastAction({ action: evt.action?.type ?? evt.action, command: evt.command });
          }
        } catch { /* ignore */ }
      };
    };

    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [arenaId]);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "voice_text", text, robot_id: robotId }));
  }, [robotId]);

  const sendAudio = useCallback((base64: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "voice_audio", audio: base64, robot_id: robotId }));
  }, [robotId]);

  return { connected, lastAction, sendText, sendAudio };
}
