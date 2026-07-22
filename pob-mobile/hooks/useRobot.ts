import { useState, useEffect, useCallback, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchRobotsByOwner, RobotState } from "../lib/program";

const SELECTED_KEY = "pob_selected_robot_name";

// A wallet can own several robots (one per name). This returns all of them
// plus a persisted "active" selection so the rest of the app (arena view,
// competition entry) has a single robot to act on by default.
export function useRobots(publicKey: PublicKey | null) {
  const [robots, setRobots] = useState<RobotState[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SELECTED_KEY).then((v) => { if (v) setSelectedName(v); });
  }, []);

  const load = useCallback(async () => {
    if (!publicKey) {
      setRobots([]);
      return;
    }
    setLoading(true);
    try {
      setRobots(await fetchRobotsByOwner(publicKey));
    } catch {
      setRobots([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey?.toString()]);

  useEffect(() => { load(); }, [load]);

  const selectRobot = useCallback((name: string) => {
    setSelectedName(name);
    AsyncStorage.setItem(SELECTED_KEY, name);
  }, []);

  const selectedRobot = useMemo(
    () => robots.find((r) => r.name === selectedName) ?? robots[0] ?? null,
    [robots, selectedName]
  );

  return { robots, selectedRobot, selectRobot, loading, reload: load };
}

// Back-compat single-robot accessor for call sites that only need "my active
// robot" plus the full list (e.g. commander checks across all owned robots).
export function useRobot(publicKey: PublicKey | null) {
  const { robots, selectedRobot, loading, reload } = useRobots(publicKey);
  return { robot: selectedRobot, robots, loading, reload };
}
