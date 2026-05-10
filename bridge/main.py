"""
Bridge — central hub connecting Seeker app, ElevenLabs, Virtuals agent,
Webots simulation, and Solana on-chain state.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import settings
from agents.battle_agent import BattleAgent
from services.elevenlabs import ElevenLabsService
from services.solana import SolanaService
from services.webots import WebotsService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

elevenlabs = ElevenLabsService(settings.ELEVENLABS_API_KEY)
solana = SolanaService(settings.SOLANA_RPC_URL, settings.BRIDGE_KEYPAIR_PATH)
webots = WebotsService(settings.WEBOTS_HOST, settings.WEBOTS_PORT, settings.WEBOTS_WS_URL)
agent = BattleAgent(settings.VIRTUALS_API_KEY, settings.VIRTUALS_AGENT_ID)

# Active WebSocket connections (arena_id → list of sockets)
arena_subscribers: dict[str, list[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Connecting to Webots simulation...")
    await webots.connect()
    asyncio.create_task(webots_event_loop())
    yield
    await webots.disconnect()


app = FastAPI(title="Proof of Battle Bridge", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request models ───────────────────────────────────────────────────────────

class SetupRequest(BaseModel):
    battle_id: int = 1
    entry_fee: int = 0
    robot_a_name: str = "UNIT_ALPHA"
    robot_b_name: str = "UNIT_BETA"
    robot_a_attack: int = 80
    robot_a_defense: int = 60
    robot_a_speed: int = 70
    robot_b_attack: int = 70
    robot_b_defense: int = 80
    robot_b_speed: int = 65


# ─── REST ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "webots_connected": webots.connected}


@app.get("/match/{arena_id}")
async def get_match(arena_id: int):
    state = await solana.fetch_match_state(arena_id)
    return state


@app.post("/admin/setup")
async def admin_setup(req: SetupRequest):
    """Register both robots and create a battle. Safe to call multiple times."""
    tx_a = await solana.register_robot(
        req.robot_a_name, req.robot_a_attack, req.robot_a_defense, req.robot_a_speed
    )
    tx_b = await solana.register_robot(
        req.robot_b_name, req.robot_b_attack, req.robot_b_defense, req.robot_b_speed
    )
    tx_battle = await solana.create_battle(
        req.battle_id, req.entry_fee, req.robot_a_name, req.robot_b_name
    )
    return {
        "robot_a_tx": tx_a,
        "robot_b_tx": tx_b,
        "battle_tx": tx_battle,
        "battle_id": req.battle_id,
    }


@app.post("/admin/battle/{battle_id}/start")
async def admin_start_battle(battle_id: int):
    """Transition battle from Waiting → Active so betting closes and combat begins."""
    tx = await solana.start_battle(battle_id)
    return {"tx": tx, "battle_id": battle_id}


# ─── WebSocket: Seeker voice commands ────────────────────────────────────────

@app.websocket("/ws/seeker/{arena_id}")
async def seeker_ws(ws: WebSocket, arena_id: str):
    await ws.accept()
    arena_subscribers.setdefault(arena_id, []).append(ws)
    log.info("Seeker connected to arena %s", arena_id)

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "voice_text":
                # Text already transcribed by ElevenLabs on the Seeker device
                command_text = data["text"]
                robot_id = data.get("robot_id", "robot_a")
                await handle_voice_command(arena_id, robot_id, command_text, ws)

            elif msg_type == "voice_audio":
                # Raw audio bytes encoded as base64 — transcribe here
                audio_b64 = data["audio"]
                command_text = await elevenlabs.transcribe_base64(audio_b64)
                robot_id = data.get("robot_id", "robot_a")
                await handle_voice_command(arena_id, robot_id, command_text, ws)

    except WebSocketDisconnect:
        arena_subscribers[arena_id].remove(ws)
        log.info("Seeker disconnected from arena %s", arena_id)


async def handle_voice_command(arena_id: str, robot_id: str, text: str, ws: WebSocket):
    log.info("Voice command [arena=%s robot=%s]: %s", arena_id, robot_id, text)

    sensor_data = await webots.get_sensor_snapshot(robot_id)
    action = await agent.decide_action(
        voice_command=text,
        robot_id=robot_id,
        sensor_data=sensor_data,
    )

    log.info("Agent decided: %s", action)
    await webots.send_command(robot_id, action)

    await ws.send_json({"type": "action_dispatched", "action": action, "command": text})
    await broadcast(arena_id, {"type": "robot_action", "robot_id": robot_id, "action": action})


# ─── WebSocket: arena viewers (frontend) ─────────────────────────────────────

@app.websocket("/ws/arena/{arena_id}")
async def arena_ws(ws: WebSocket, arena_id: str):
    await ws.accept()
    arena_subscribers.setdefault(arena_id, []).append(ws)
    try:
        while True:
            await asyncio.sleep(60)  # keep-alive
    except WebSocketDisconnect:
        arena_subscribers[arena_id].remove(ws)


# ─── Webots event loop ───────────────────────────────────────────────────────

async def webots_event_loop():
    """Continuously read events from Webots and propagate them."""
    async for event in webots.event_stream():
        event_type = event.get("type")

        if event_type == "collision":
            await handle_collision(event)
        elif event_type == "match_over":
            await handle_match_over(event)
        elif event_type == "sensor_update":
            arena_id = event.get("arena_id", "1")
            await broadcast(str(arena_id), {"type": "sensor_update", "data": event})


async def handle_collision(event: dict):
    arena_id = str(event["arena_id"])
    attacker = event["attacker"]   # "robot_a" | "robot_b"
    target = event["target"]       # "robot_a" | "robot_b"
    damage = int(event["damage"])

    log.info("Collision: %s hit %s for %d damage", attacker, target, damage)

    tx_sig = await solana.report_damage(
        arena_id=int(arena_id),
        target=target,
        damage=damage,
        hit_description=event.get("description", "Impact detected"),
    )

    commentary = await elevenlabs.generate_commentary(
        f"{attacker} smashes {target} for {damage} points of damage!"
    )

    match_state = await solana.fetch_match_state(int(arena_id))

    await broadcast(arena_id, {
        "type": "damage",
        "attacker": attacker,
        "target": target,
        "damage": damage,
        "hp_a": match_state["hp_a"],
        "hp_b": match_state["hp_b"],
        "tx": tx_sig,
        "commentary_audio": commentary,
    })

    # If damage brought HP to zero, Webots will also emit match_over separately.
    # This handles the edge case where the on-chain program already resolved.
    if match_state.get("status") == "Finished":
        winner = match_state.get("winner")
        await broadcast(arena_id, {
            "type": "match_over",
            "winner": winner,
            "tx": tx_sig,
        })


async def handle_match_over(event: dict):
    """Called when Webots simulation declares a winner. Resolves battle on-chain."""
    arena_id = str(event["arena_id"])
    winner_str = event.get("winner", "robot_a")  # "robot_a" | "robot_b"
    winner_side = 0 if winner_str == "robot_a" else 1

    log.info("Match over: arena=%s winner=%s (side=%d)", arena_id, winner_str, winner_side)

    tx_sig = await solana.resolve_battle(
        arena_id=int(arena_id),
        winner_side=winner_side,
    )

    commentary = await elevenlabs.generate_commentary(
        f"The battle is over! {winner_str.replace('_', ' ').title()} is victorious!"
    )

    match_state = await solana.fetch_match_state(int(arena_id))

    await broadcast(arena_id, {
        "type": "match_over",
        "winner": winner_side,
        "winner_label": winner_str,
        "hp_a": match_state.get("hp_a", 0),
        "hp_b": match_state.get("hp_b", 0),
        "tx": tx_sig,
        "commentary_audio": commentary,
    })


async def broadcast(arena_id: str, message: dict):
    dead = []
    for ws in arena_subscribers.get(arena_id, []):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        arena_subscribers[arena_id].remove(ws)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
