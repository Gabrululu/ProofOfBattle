"""
Bridge — central hub connecting Seeker app, ElevenLabs, Virtuals agent,
Webots simulation, and Solana on-chain state.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
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

# ── In-memory metadata stores ─────────────────────────────────────────────────
competitions: dict[int, dict] = {}
robot_profiles: dict[str, dict] = {}  # owner_pubkey → profile


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


class TeamMemberModel(BaseModel):
    wallet: str = ""
    alias: str = ""
    share: int = 0  # percentage


class CompetitionRequest(BaseModel):
    battle_id: int
    name: str
    location: str
    creator: str = ""
    is_team: bool = False
    team_name: str | None = None
    members: list[TeamMemberModel] = []
    # "online" = Webots + AI agent decide combat (default); "physical" = real
    # robots refereed by the creator, with an optional live stream to watch.
    mode: str = "online"
    stream_url: str = ""
    # The creator signs create_battle directly from the frontend (required so
    # the on-chain robot_a.owner == creator constraint holds for their real,
    # already-registered robot) — this is that transaction's signature, kept
    # here only for display/bookkeeping.
    on_chain_tx: str = ""
    # Robot combatants (display metadata only — the on-chain Battle account
    # is the source of truth for which robots are actually fighting)
    robot_a_name: str = "UNIT_ALPHA"
    robot_a_attack: int = 70
    robot_a_defense: int = 60
    robot_a_speed: int = 65
    robot_b_name: str = "UNIT_BETA"
    robot_b_attack: int = 70
    robot_b_defense: int = 60
    robot_b_speed: int = 65


class ReportDamageRequest(BaseModel):
    creator: str = ""
    side: int  # 0 = robot_a, 1 = robot_b (the side that GOT hit)
    damage: int
    description: str = ""


class ResolveBattleRequest(BaseModel):
    creator: str = ""
    winner: int  # 0 = robot_a, 1 = robot_b


class RobotProfileRequest(BaseModel):
    owner: str
    name: str
    attack: int = 70
    defense: int = 60
    speed: int = 65
    categories: list[str] = []


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
    """Transition battle from Waiting → Active so backing closes and combat begins."""
    tx = await solana.start_battle(battle_id)
    if battle_id in competitions:
        competitions[battle_id]["status"] = "active"
    return {"tx": tx, "battle_id": battle_id}


# ── Competition metadata API ──────────────────────────────────────────────────

@app.post("/api/competition")
async def create_competition_meta(req: CompetitionRequest):
    """Pure off-chain metadata. The on-chain `create_battle` call now happens
    client-side (the creator's own wallet signs it, required so the program's
    `robot_a.owner == creator.key()` constraint holds for their real,
    already-registered robot) — the frontend calls this endpoint only *after*
    that transaction confirms, passing its signature for display."""
    competitions[req.battle_id] = {
        "battle_id": req.battle_id,
        "name": req.name,
        "location": req.location,
        "creator": req.creator,
        "is_team": req.is_team,
        "team_name": req.team_name,
        "members": [m.model_dump() for m in req.members],
        "status": "waiting",
        "viewer_count": 0,
        "mode": req.mode,
        "stream_url": req.stream_url,
        "on_chain_tx": req.on_chain_tx,
        # Robot combatant info
        "robot_a_name": req.robot_a_name,
        "robot_a_attack": req.robot_a_attack,
        "robot_a_defense": req.robot_a_defense,
        "robot_a_speed": req.robot_a_speed,
        "robot_b_name": req.robot_b_name,
        "robot_b_attack": req.robot_b_attack,
        "robot_b_defense": req.robot_b_defense,
        "robot_b_speed": req.robot_b_speed,
    }
    log.info("Competition registered: %s (id=%d, mode=%s)", req.name, req.battle_id, req.mode)
    return competitions[req.battle_id]


@app.get("/api/competitions")
async def list_competitions_meta():
    return list(competitions.values())


@app.get("/api/competition/{battle_id}")
async def get_competition_meta(battle_id: int):
    return competitions.get(battle_id, {})


def _profile_key(owner: str, name: str) -> str:
    return f"{owner}:{name}"


@app.post("/api/robot-profile")
async def save_robot_profile(req: RobotProfileRequest):
    key = _profile_key(req.owner, req.name)
    robot_profiles[key] = {
        "owner": req.owner,
        "name": req.name,
        "attack": req.attack,
        "defense": req.defense,
        "speed": req.speed,
        "categories": req.categories,
    }
    return robot_profiles[key]


@app.get("/api/robot-profile/{owner}")
async def get_robot_profile(owner: str):
    """Returns ALL robot profiles for this owner (a wallet can register several)."""
    return [p for p in robot_profiles.values() if p["owner"] == owner]


@app.get("/api/robot-profiles")
async def list_robot_profiles():
    return list(robot_profiles.values())


@app.get("/api/leaderboard")
async def get_leaderboard():
    """Merge bridge profiles with on-chain wins/losses, sort by wins desc."""
    entries = []
    for profile in robot_profiles.values():
        entry = dict(profile)
        on_chain = await solana.fetch_robot_state(profile["owner"], profile["name"])
        if on_chain:
            entry["wins"]      = on_chain["wins"]
            entry["losses"]    = on_chain["losses"]
            entry["hp"]        = on_chain["hp"]
            entry["is_active"] = on_chain["is_active"]
        else:
            entry.setdefault("wins",      0)
            entry.setdefault("losses",    0)
            entry.setdefault("hp",        100)
            entry.setdefault("is_active", False)
        entries.append(entry)
    entries.sort(key=lambda e: (e["wins"], -e["losses"]), reverse=True)
    return entries


@app.get("/api/battles/history/{owner}")
async def get_battle_history(owner: str):
    """Return competitions created by this owner, most recent first."""
    history = [
        comp for comp in competitions.values()
        if comp.get("creator") == owner
    ]
    history.sort(key=lambda c: c["battle_id"], reverse=True)
    return history


@app.post("/api/competition/{battle_id}/start")
async def start_competition_flow(
    battle_id: int,
    creator: str = Query(default=""),
):
    """Transition Waiting→Active, closing the backing window and starting combat.

    The on-chain battle is created client-side, at competition-creation time
    (see /api/competition's docstring), so it spends real time in "Waiting"
    status where place_bet() can succeed before this flips it to Active.
    """
    comp = competitions.get(battle_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if creator and comp.get("creator") and comp["creator"] != creator:
        raise HTTPException(status_code=403, detail="Only the creator can start this battle")

    results: dict = {}

    # Transition Waiting → Active
    try:
        results["tx_start"] = await solana.start_battle(battle_id)
        competitions[battle_id]["status"] = "active"
        results["success"] = True
        log.info("Battle %d started by %s", battle_id, creator or "admin")
    except Exception as e:
        results["success"] = False
        results["error"] = str(e)
        return results

    # Notify all subscribers watching this arena
    await broadcast(str(battle_id), {
        "type": "battle_started",
        "battle_id": battle_id,
        "robot_a": comp["robot_a_name"],
        "robot_b": comp["robot_b_name"],
    })

    return results


@app.post("/api/competition/{battle_id}/report")
async def report_physical_damage(battle_id: int, req: ReportDamageRequest):
    """Referee input for a 'physical' competition: record a hit and broadcast
    it over the same arena WebSocket an online (Webots-driven) battle would
    use. Reuses handle_collision() directly — no Webots involved."""
    comp = competitions.get(battle_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if comp.get("mode") != "physical":
        raise HTTPException(status_code=400, detail="Only physical competitions can report damage manually")
    if req.creator and comp.get("creator") and comp["creator"] != req.creator:
        raise HTTPException(status_code=403, detail="Only the creator can referee this battle")

    target = "robot_a" if req.side == 0 else "robot_b"
    attacker = "robot_b" if req.side == 0 else "robot_a"
    await handle_collision({
        "arena_id": battle_id,
        "attacker": attacker,
        "target": target,
        "damage": req.damage,
        "description": req.description or "Referee-reported hit",
    })
    return {"success": True}


@app.post("/api/competition/{battle_id}/resolve")
async def resolve_physical_battle(battle_id: int, req: ResolveBattleRequest):
    """Referee input for a 'physical' competition: declare the winner. Reuses
    handle_match_over() directly — no Webots involved."""
    comp = competitions.get(battle_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Competition not found")
    if comp.get("mode") != "physical":
        raise HTTPException(status_code=400, detail="Only physical competitions can be resolved manually")
    if req.creator and comp.get("creator") and comp["creator"] != req.creator:
        raise HTTPException(status_code=403, detail="Only the creator can referee this battle")

    await handle_match_over({
        "arena_id": battle_id,
        "winner": "robot_a" if req.winner == 0 else "robot_b",
    })
    return {"success": True}


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
    bid = int(arena_id) if arena_id.isdigit() else None
    if bid is not None and bid in competitions:
        competitions[bid]["viewer_count"] += 1
    try:
        while True:
            await asyncio.sleep(60)  # keep-alive
    except WebSocketDisconnect:
        if ws in arena_subscribers.get(arena_id, []):
            arena_subscribers[arena_id].remove(ws)
        if bid is not None and bid in competitions:
            competitions[bid]["viewer_count"] = max(
                0, competitions[bid]["viewer_count"] - 1
            )


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
    bid = int(arena_id) if arena_id.isdigit() else None
    if bid is not None and bid in competitions:
        competitions[bid]["status"] = "finished"

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
