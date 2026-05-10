"""
Virtuals Protocol G.A.M.E. battle agent.

API key format matters:
  apt-xxx  → V2 SDK (sdk.game.virtuals.io)  ← use this
  other    → V1 HTTP (api.virtuals.io/api/v1) ← legacy fallback

The agent (ARES) is defined by the system prompt below — no UI setup or
token minting needed. One Chat session is kept per robot so the agent
accumulates battle context across commands within a match.
"""
import asyncio
import json
import logging
import re
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


def _parse_action(text: str) -> dict:
    """Extract a JSON action dict from the agent's text response."""
    text = text.strip()
    # 1. Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 2. JSON inside a markdown code block
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    # 3. Any JSON object in the text
    m = re.search(r"\{[^{}]+\}", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError(f"No JSON action in agent response: {text!r}")


class BattleAgent:
    def __init__(self, api_key: str, agent_id: str = ""):
        self._api_key   = api_key
        self._agent_id  = agent_id
        self._use_v2    = api_key.startswith("apt-")
        self._chats: dict[str, Any] = {}   # robot_id → Chat (V2) or None
        self._http      = httpx.AsyncClient(timeout=10)

        if self._use_v2:
            try:
                from game_sdk.game.chat_agent import ChatAgent as _GameChatAgent
                self._game_agent = _GameChatAgent(api_key=api_key, prompt=SYSTEM_PROMPT)
                log.info("Virtuals G.A.M.E. V2 SDK ready")
            except Exception as e:
                log.warning("game-sdk import failed (%s) — falling back to V1 HTTP", e)
                self._use_v2 = False

    # ── Public ────────────────────────────────────────────────────────────────

    async def decide_action(
        self,
        voice_command: str,
        robot_id: str,
        sensor_data: dict[str, Any],
    ) -> dict:
        message = (
            f'Voice command: "{voice_command}"\n'
            f"Sensor data: {json.dumps(sensor_data, indent=2)}"
        )
        try:
            if self._use_v2:
                action = await asyncio.get_event_loop().run_in_executor(
                    None, self._v2_decide, robot_id, message
                )
            else:
                action = await self._v1_decide(message)
        except Exception as exc:
            log.warning("Virtuals API failed (%s) — rule engine", exc)
            action = self._rule_engine(voice_command, sensor_data)
        return action

    # ── V2 SDK (apt- keys) ────────────────────────────────────────────────────

    def _v2_decide(self, robot_id: str, message: str) -> dict:
        if robot_id not in self._chats:
            self._chats[robot_id] = self._game_agent.create_chat(
                partner_id=robot_id,
                partner_name=f"Robot {robot_id.replace('_', ' ').title()}",
            )
        chat = self._chats[robot_id]
        response = chat.next(message)
        return _parse_action(response.message)

    def reset_chat(self, robot_id: str) -> None:
        """Call between matches to clear accumulated context for a robot."""
        self._chats.pop(robot_id, None)

    # ── V1 HTTP fallback (legacy keys) ────────────────────────────────────────

    async def _v1_decide(self, message: str) -> dict:
        payload = {"text": message, "systemPrompt": SYSTEM_PROMPT}
        headers = {"x-api-key": self._api_key, "Content-Type": "application/json"}
        endpoint = (
            f"https://api.virtuals.io/api/v1/agents/{self._agent_id}/game"
            if self._agent_id
            else "https://api.virtuals.io/api/v1/agents/game"
        )
        resp = await self._http.post(endpoint, json=payload, headers=headers)
        resp.raise_for_status()
        raw = resp.json().get("data", {}).get("text", "{}")
        return _parse_action(raw)

    # ── Deterministic rule engine (always-available fallback) ─────────────────

    def _rule_engine(self, command: str, sensors: dict) -> dict:
        cmd  = command.lower()
        hp   = sensors.get("hp", 100)
        dist = sensors.get("enemy_distance")

        if hp < 20:
            return {"action": "move_backward", "intensity": 1.0, "reason": "Low HP — retreat"}
        if any(w in cmd for w in ("attack", "hit", "strike", "charge", "ram")):
            if dist is not None and dist < 1.5:
                return {"action": "attack", "intensity": 1.0, "reason": "Attack — enemy in range"}
            return {"action": "move_forward", "intensity": 0.8, "reason": "Close distance first"}
        if any(w in cmd for w in ("forward", "advance", "adelante")):
            return {"action": "move_forward",  "intensity": 0.7, "reason": "Forward command"}
        if any(w in cmd for w in ("back", "retreat", "atrás", "atras")):
            return {"action": "move_backward", "intensity": 0.7, "reason": "Retreat command"}
        if any(w in cmd for w in ("left", "izquierda")):
            return {"action": "move_left",     "intensity": 0.6, "reason": "Left command"}
        if any(w in cmd for w in ("right", "derecha")):
            return {"action": "move_right",    "intensity": 0.6, "reason": "Right command"}
        if any(w in cmd for w in ("spin", "rotate", "turn")):
            return {"action": "rotate_left",   "intensity": 0.5, "reason": "Rotate command"}
        if any(w in cmd for w in ("boost", "turbo")):
            return {"action": "boost",         "intensity": 1.0, "reason": "Boost command"}
        if any(w in cmd for w in ("defend", "block", "shield")):
            return {"action": "brake",         "intensity": 0.8, "reason": "Defend — brace for impact"}
        return {"action": "idle", "intensity": 0.0, "reason": "No matching command"}
