"""
Webots service — communicates with the Webots supervisor controller.
Protocol: newline-delimited JSON over either raw TCP or WebSocket.

TCP mode  (default): direct asyncio connection to WEBOTS_HOST:WEBOTS_PORT
WS mode   (Cloudflare): set WEBOTS_WS_URL=wss://xyz.trycloudflare.com
          Requires ws_bridge.py running in Codespace alongside Webots.
"""
import asyncio
import json
import logging
from typing import AsyncIterator

log = logging.getLogger(__name__)


class WebotsService:
    def __init__(self, host: str, port: int, ws_url: str = ""):
        self._host = host
        self._port = port
        self._ws_url = ws_url.strip()
        # TCP mode
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        # WebSocket mode
        self._ws = None
        self.connected = False
        self._sensor_cache: dict[str, dict] = {}

    # ── Connection ────────────────────────────────────────────────────────────

    async def connect(self):
        if self._ws_url:
            await self._connect_ws()
        else:
            await self._connect_tcp()

    async def _connect_tcp(self):
        try:
            self._reader, self._writer = await asyncio.open_connection(self._host, self._port)
            self.connected = True
            log.info("Webots TCP connected at %s:%d", self._host, self._port)
        except OSError as e:
            log.warning("Webots TCP not reachable (%s) — mock mode", e)
            self.connected = False

    async def _connect_ws(self):
        try:
            import websockets  # local import — optional dep for WS mode
            self._ws = await websockets.connect(self._ws_url)
            self.connected = True
            log.info("Webots WS connected at %s", self._ws_url)
        except Exception as e:
            log.warning("Webots WS not reachable (%s) — mock mode", e)
            self.connected = False

    async def disconnect(self):
        if self._writer:
            self._writer.close()
            await self._writer.wait_closed()
        if self._ws:
            await self._ws.close()
        self.connected = False

    # ── Send ─────────────────────────────────────────────────────────────────

    async def send_command(self, robot_id: str, action: dict):
        msg = json.dumps({"type": "command", "robot_id": robot_id, **action}) + "\n"
        if not self.connected:
            log.debug("Mock command: %s", msg.strip())
            return
        if self._ws:
            await self._ws.send(msg.rstrip("\n"))
        elif self._writer:
            self._writer.write(msg.encode())
            await self._writer.drain()

    # ── Sensor snapshot (request-response) ───────────────────────────────────

    async def get_sensor_snapshot(self, robot_id: str) -> dict:
        if not self.connected:
            return self._mock_sensors(robot_id)
        request = json.dumps({"type": "sensor_request", "robot_id": robot_id}) + "\n"
        try:
            if self._ws:
                await self._ws.send(request.rstrip("\n"))
                raw = await asyncio.wait_for(self._ws.recv(), timeout=2.0)
                data = json.loads(raw)
            else:
                self._writer.write(request.encode())
                await self._writer.drain()
                line = await asyncio.wait_for(self._reader.readline(), timeout=2.0)
                data = json.loads(line.decode())
            self._sensor_cache[robot_id] = data
            return data
        except Exception as e:
            log.warning("Sensor snapshot failed (%s), using cache", e)
            return self._sensor_cache.get(robot_id, self._mock_sensors(robot_id))

    # ── Event stream ─────────────────────────────────────────────────────────

    async def event_stream(self) -> AsyncIterator[dict]:
        if not self.connected:
            async for event in self._mock_event_stream():
                yield event
            return

        if self._ws:
            async for event in self._ws_event_stream():
                yield event
        else:
            async for event in self._tcp_event_stream():
                yield event

    async def _tcp_event_stream(self) -> AsyncIterator[dict]:
        while True:
            try:
                line = await self._reader.readline()
                if not line:
                    log.warning("Webots TCP connection closed")
                    break
                yield json.loads(line.decode())
            except Exception as e:
                log.error("Webots TCP stream error: %s", e)
                break

    async def _ws_event_stream(self) -> AsyncIterator[dict]:
        try:
            async for message in self._ws:
                try:
                    yield json.loads(message)
                except json.JSONDecodeError:
                    log.warning("Malformed WS message: %s", message)
        except Exception as e:
            log.error("Webots WS stream error: %s", e)

    # ── Mocks ─────────────────────────────────────────────────────────────────

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
