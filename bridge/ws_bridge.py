"""
ws_bridge.py — WebSocket → TCP proxy for Webots (runs in Codespace)

Webots exposes a raw TCP server on port 5005 (newline-delimited JSON).
This script wraps it as a WebSocket so Cloudflare Tunnel can expose it publicly.

Start order in Codespace:
  1. Open Webots → Play (starts TCP server on :5005)
  2. python bridge/ws_bridge.py
  3. cloudflared tunnel --url http://localhost:5006
  4. Copy the *.trycloudflare.com URL → set WEBOTS_WS_URL in Railway

Protocol: each TCP line becomes one WebSocket text message, and vice versa.
"""

import asyncio
import logging
import os

import websockets

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

WS_PORT  = int(os.getenv("WS_BRIDGE_PORT", "5006"))
TCP_HOST = os.getenv("WEBOTS_HOST", "127.0.0.1")
TCP_PORT = int(os.getenv("WEBOTS_PORT", "5005"))


async def handle(ws) -> None:
    log.info("Client connected: %s", ws.remote_address)
    try:
        reader, writer = await asyncio.open_connection(TCP_HOST, TCP_PORT)
        log.info("Proxying WS ↔ TCP %s:%d", TCP_HOST, TCP_PORT)
    except OSError as e:
        log.error("Cannot reach Webots TCP: %s", e)
        await ws.close(1011, "Webots unavailable")
        return

    async def ws_to_tcp() -> None:
        async for message in ws:
            data = message if isinstance(message, bytes) else (message + "\n").encode()
            writer.write(data)
            await writer.drain()

    async def tcp_to_ws() -> None:
        while True:
            line = await reader.readline()
            if not line:
                log.warning("Webots TCP closed")
                break
            await ws.send(line.decode().rstrip("\n"))

    try:
        done, pending = await asyncio.wait(
            [asyncio.create_task(ws_to_tcp()), asyncio.create_task(tcp_to_ws())],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        writer.close()
        log.info("Client disconnected")


async def main() -> None:
    log.info("WS bridge  ws://0.0.0.0:%d  →  tcp://%s:%d", WS_PORT, TCP_HOST, TCP_PORT)
    log.info("Run: cloudflared tunnel --url http://localhost:%d", WS_PORT)
    async with websockets.serve(handle, "0.0.0.0", WS_PORT):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
