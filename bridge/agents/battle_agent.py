"""
Virtuals Protocol battle agent.
Receives a voice command + live sensor data and returns a concrete robot action.
"""
import json
import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are ARES, a tactical AI that controls battle robots in a simulation arena.
You receive a voice command from the robot's owner and live sensor data from the simulation.
You must output ONE action as a JSON object from the allowed action list.

Allowed actions:
  move_forward, move_backward, move_left, move_right,
  rotate_left, rotate_right, attack, boost, brake, idle

Sensor data fields:
  - position: {x, y}
  - heading_deg: float (0=north, 90=east)
  - hp: int (0-100)
  - enemy_distance: float | null (meters, null if out of sensor range)
  - enemy_bearing_deg: float | null
  - collision_front: bool
  - collision_rear: bool

Rules:
  - Prioritise survival: if hp < 20, retreat.
  - If enemy_distance < 1.5 and the owner says "attack", execute attack.
  - Translate natural language to the closest matching action.
  - Never output multiple actions; pick exactly one.

Output format (strict JSON, nothing else):
{"action": "<action_name>", "intensity": <0.0-1.0>, "reason": "<one sentence>"}
"""


class BattleAgent:
    def __init__(self, api_key: str):
        self._api_key = api_key
        # Virtuals Protocol Game Agent endpoint
        self._base_url = "https://api.virtuals.io/api/v1"
        self._client = httpx.AsyncClient(timeout=10)

    async def decide_action(
        self,
        voice_command: str,
        robot_id: str,
        sensor_data: dict[str, Any],
    ) -> dict:
        user_message = (
            f"Voice command: \"{voice_command}\"\n"
            f"Sensor data: {json.dumps(sensor_data, indent=2)}"
        )

        try:
            response = await self._call_virtuals(user_message)
        except Exception as exc:
            log.warning("Virtuals API failed (%s), falling back to rule engine", exc)
            response = self._rule_engine(voice_command, sensor_data)

        return response

    async def _call_virtuals(self, user_message: str) -> dict:
        payload = {
            "text": user_message,
            "systemPrompt": SYSTEM_PROMPT,
        }
        headers = {"x-api-key": self._api_key, "Content-Type": "application/json"}
        resp = await self._client.post(
            f"{self._base_url}/agents/game",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        # Extract the text response and parse as JSON
        raw_text = data.get("data", {}).get("text", "{}")
        return json.loads(raw_text)

    def _rule_engine(self, command: str, sensors: dict) -> dict:
        """Deterministic fallback when the Virtuals API is unavailable."""
        cmd = command.lower()
        hp = sensors.get("hp", 100)
        enemy_dist = sensors.get("enemy_distance")

        if hp < 20:
            return {"action": "move_backward", "intensity": 1.0, "reason": "Low HP — retreat"}

        if "attack" in cmd or "hit" in cmd or "strike" in cmd:
            if enemy_dist is not None and enemy_dist < 1.5:
                return {"action": "attack", "intensity": 1.0, "reason": "Attack command, enemy in range"}
            return {"action": "move_forward", "intensity": 0.8, "reason": "Close in before attacking"}

        if "forward" in cmd or "advance" in cmd or "adelante" in cmd:
            return {"action": "move_forward", "intensity": 0.7, "reason": "Forward command"}
        if "back" in cmd or "retreat" in cmd or "atrás" in cmd:
            return {"action": "move_backward", "intensity": 0.7, "reason": "Retreat command"}
        if "left" in cmd or "izquierda" in cmd:
            return {"action": "move_left", "intensity": 0.6, "reason": "Left command"}
        if "right" in cmd or "derecha" in cmd:
            return {"action": "move_right", "intensity": 0.6, "reason": "Right command"}
        if "spin" in cmd or "rotate" in cmd or "turn" in cmd:
            return {"action": "rotate_left", "intensity": 0.5, "reason": "Rotate command"}
        if "boost" in cmd or "turbo" in cmd:
            return {"action": "boost", "intensity": 1.0, "reason": "Boost command"}

        return {"action": "idle", "intensity": 0.0, "reason": "No matching command"}
