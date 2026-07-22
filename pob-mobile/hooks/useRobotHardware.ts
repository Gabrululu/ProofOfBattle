import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_REPEAT_MS = 125; // ~8Hz — fast enough to feel responsive, keeps
                             // the robot's 500ms watchdog comfortably fed.

// Direct WebSocket link from the phone to a robot's ESP32, over local WiFi —
// no bridge/internet round-trip, since physical-mode control is local-network
// by design (see firmware/robot-controller). Reuses the same
// {action, intensity} vocabulary bridge/agents/battle_agent.py already
// established for the simulated (Webots) robots.
export function useRobotHardware() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendCommand = useCallback((action: string, intensity: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action, intensity }));
  }, []);

  const disconnect = useCallback(() => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setConnecting(false);
  }, []);

  const connect = useCallback((ip: string) => {
    disconnect();
    setConnecting(true);
    const ws = new WebSocket(`ws://${ip}:81`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setConnecting(false); };
    ws.onclose = () => { setConnected(false); setConnecting(false); };
    ws.onerror = () => ws.close();
  }, [disconnect]);

  // Call while a control button is held (repeats at HOLD_REPEAT_MS so the
  // robot's watchdog stays fed); call with action=null on release to stop.
  const holdAction = useCallback((action: string | null, intensity = 100) => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (action === null) {
      sendCommand("stop", 0);
      return;
    }
    sendCommand(action, intensity);
    holdIntervalRef.current = setInterval(() => sendCommand(action, intensity), HOLD_REPEAT_MS);
  }, [sendCommand]);

  useEffect(() => () => disconnect(), [disconnect]);

  return { connected, connecting, connect, disconnect, holdAction };
}
