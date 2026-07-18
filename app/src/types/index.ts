export type RobotId = "robot_a" | "robot_b";

export interface MatchState {
  arenaId: number;
  hpA: number;
  hpB: number;
  round: number;
  status: "Active" | "Paused" | "Finished" | "Unknown";
  winner: string | null;
}

export interface DamageEvent {
  type: "damage";
  attacker: RobotId;
  target: RobotId;
  damage: number;
  hpA: number;
  hpB: number;
  tx: string;
  commentaryAudio?: string;
}

export interface SensorUpdate {
  type: "sensor_update";
  arenaId: number;
  robotA: { hp: number; position: { x: number; y: number } };
  robotB: { hp: number; position: { x: number; y: number } };
}

export interface MatchOverEvent {
  type: "match_over";
  winner: string;
  tx: string;
}

export type ArenaEvent = DamageEvent | SensorUpdate | MatchOverEvent;

// ── New types for competition & robot management ─────────────────────────────

export interface TeamMember {
  wallet: string;
  alias: string;
  share: number; // 0-100 percentage
}

export interface RobotInfo {
  name: string;
  attack: number;
  defense: number;
  speed: number;
  categories?: string[];
}

export interface CompetitionMeta {
  battleId: number;
  name: string;
  location: string;
  creator: string;
  isTeam: boolean;
  teamName?: string;
  members?: TeamMember[];
  status: "waiting" | "active" | "finished";
  viewerCount: number;
  robotA?: RobotInfo;
  robotB?: RobotInfo;
}

export const ROBOT_CATEGORIES = [
  "SUMO",
  "COMBAT",
  "LINE FOLLOW",
  "MAZE",
  "BATTLE ROYALE",
] as const;

export type RobotCategory = (typeof ROBOT_CATEGORIES)[number];

export type AppView = "live" | "arena" | "robot" | "compete" | "rank" | "hist";
