import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { fetchRobotState, RobotState } from "../lib/program";

export function useRobot(publicKey: PublicKey | null) {
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!publicKey) {
      setRobot(null);
      return;
    }
    setLoading(true);
    try {
      setRobot(await fetchRobotState(publicKey));
    } catch {
      setRobot(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey?.toString()]);

  useEffect(() => { load(); }, [load]);

  return { robot, loading, reload: load };
}
