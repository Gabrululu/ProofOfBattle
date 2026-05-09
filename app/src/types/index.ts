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
