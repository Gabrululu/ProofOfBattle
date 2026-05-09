"""
Webots service — TCP socket communication with the Webots supervisor controller.
Protocol: newline-delimited JSON.
"""
import asyncio
import json
import logging
from typing import AsyncIterator

log = logging.getLogger(__name__)


class WebotsService:
    def __init__(self, host: str, port: int):
        self._host = host
        self._port = port
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self.connected = False
        self._sensor_cache: dict[str, dict] = {}

    async def connect(self):
        try:
            self._reader, self._writer = await asyncio.open_connection(self._host, self._port)
            self.connected = True
            log.info("Connected to Webots at %s:%d", self._host, self._port)
        except OSError as e:
            log.warning("Webots not reachable (%s) — running in mock mode", e)
            self.connected = False

    async def disconnect(self):
        if self._writer:
            self._writer.close()
            await self._writer.wait_closed()
        self.connected = False

    async def send_command(self, robot_id: str, action: dict):
        msg = json.dumps({"type": "command", "robot_id": robot_id, **action}) + "\n"
        if self.connected and self._writer:
            self._writer.write(msg.encode())
            await self._writer.drain()
        else:
            log.debug("Mock command: %s", msg.strip())

    async def get_sensor_snapshot(self, robot_id: str) -> dict:
        if not self.connected:
            return self._mock_sensors(robot_id)
        request = json.dumps({"type": "sensor_request", "robot_id": robot_id}) + "\n"
        self._writer.write(request.encode())
        await self._writer.drain()
        line = await asyncio.wait_for(self._reader.readline(), timeout=2.0)
        data = json.loads(line.decode())
        self._sensor_cache[robot_id] = data
        return data

    async def event_stream(self) -> AsyncIterator[dict]:
        """Yields events from Webots (collisions, sensor ticks, etc.)."""
        if not self.connected:
            async for event in self._mock_event_stream():
                yield event
            return

        while True:
            try:
                line = await self._reader.readline()
                if not line:
                    log.warning("Webots connection closed")
                    break
                yield json.loads(line.decode())
            except Exception as e:
                log.error("Webots stream error: %s", e)
                break

    @staticmethod
    def _mock_sensors(robot_id: str) -> dict:
        return {
            "robot_id": robot_id,
            "position": {"x": 0.5, "y": 0.5},
            "heading_deg": 90.0,
            "hp": 100,
            "enemy_distance": 2.3,
            "enemy_bearing_deg": 45.0,
            "collision_front": False,
            "collision_rear": False,
        }

    @staticmethod
    async def _mock_event_stream() -> AsyncIterator[dict]:
        """Synthetic events for local development without Webots."""
        import random

        await asyncio.sleep(5)
        events = [
            {"type": "collision", "arena_id": 1, "attacker": "robot_a", "target": "robot_b",
             "damage": random.randint(10, 25), "description": "Frontal ram!"},
            {"type": "collision", "arena_id": 1, "attacker": "robot_b", "target": "robot_a",
             "damage": random.randint(5, 20), "description": "Counter-spin!"},
            {"type": "sensor_update", "arena_id": 1,
             "robot_a": {"hp": 80, "position": {"x": 0.3, "y": 0.7}},
             "robot_b": {"hp": 65, "position": {"x": 0.7, "y": 0.3}}},
        ]
        for event in events:
            await asyncio.sleep(random.uniform(3, 8))
            yield event
