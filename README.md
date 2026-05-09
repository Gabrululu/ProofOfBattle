# ⚔️ Proof of Battle

> *"Imagina si BattleBots tuviera un smart contract como árbitro, ElevenLabs como comentarista, y el Seeker como control remoto."*

The on-chain arena where student robots are born, trained, and battle for glory.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CIRCULAR DATA FLOW                              │
│                                                                     │
│  📱 Seeker App          🐍 Bridge (Python)       🤖 Webots           │
│  ┌──────────┐           ┌─────────────┐          ┌──────────────┐  │
│  │ Voice    │──voice──▶ │ ElevenLabs  │          │ Simulation   │  │
│  │ capture  │           │ STT         │          │              │  │
│  │          │           │      │      │          │              │  │
│  │          │           │ Virtuals    │◀─sensors─│ Sensors      │  │
│  │          │           │ Agent       │──action─▶│ Motors       │  │
│  │          │◀─events── │      │      │          │ Collision    │  │
│  └──────────┘           │ Solana svc  │◀─impact──│ Detection    │  │
│                         └─────┬───────┘          └──────────────┘  │
│                               │ sign tx                            │
│                         ┌─────▼───────┐                            │
│                         │ ⛓ Solana    │                            │
│                         │ (Anchor)    │                            │
│                         │ match state │                            │
│                         └─────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
ProofOfBattle/
├── on-chain/               # Anchor / Solana smart contract
│   ├── programs/proof-of-battle/src/lib.rs
│   ├── tests/proof_of_battle.ts
│   └── Anchor.toml
├── bridge/                 # Python orchestration hub
│   ├── main.py             # FastAPI + WebSocket server
│   ├── agents/battle_agent.py   # Virtuals Protocol AI
│   └── services/
│       ├── elevenlabs.py   # STT + TTS commentary
│       ├── solana.py       # Transaction signing
│       └── webots.py       # Simulation socket
├── simulation/             # Webots robot battle
│   ├── worlds/arena.wbt
│   └── controllers/robot_controller/robot_controller.py
└── app/                    # React mobile-first Seeker UI
    └── src/
        ├── App.tsx
        ├── components/     # HealthBar, Arena, VoiceControl, Commentary
        └── hooks/          # useWebSocket, useVoice
```

## Quick Start

### 1 · On-Chain (Anchor)

```bash
# Install: https://www.anchor-lang.com/docs/installation
cd on-chain
anchor build
anchor deploy          # targets Devnet by default
anchor test
```

Copy the deployed program ID into `Anchor.toml` and `bridge/.env`.

### 2 · Bridge (Python)

```bash
cd bridge
cp .env.example .env   # fill in your API keys
pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

### 3 · Simulation (Webots)

1. Install [Webots R2023b](https://cyberbotics.com)
2. Open `simulation/worlds/arena.wbt`
3. Press **Play** — the controller auto-connects to the bridge on `:5005`

### 4 · App (Seeker UI)

```bash
cd app
cp .env.example .env   # set VITE_BRIDGE_URL
npm install
npm run dev
# → http://localhost:5173
```

Open on your phone (same network) and use **Hold to Command**.

---

## API Keys Needed

| Service | Where to get |
|---------|-------------|
| ElevenLabs | elevenlabs.io → API Keys |
| Virtuals Protocol | virtuals.io → Developer Portal |
| Solana wallet | `solana-keygen new` |

## WebSocket Protocol

### `/ws/seeker/{arena_id}` — Seeker → Bridge
```json
{ "type": "voice_text", "text": "Attack!", "robot_id": "robot_a" }
{ "type": "voice_audio", "audio": "<base64-webm>", "robot_id": "robot_b" }
```

### `/ws/arena/{arena_id}` — Bridge → UI
```json
{ "type": "damage", "attacker": "robot_a", "target": "robot_b", "damage": 15, "hp_a": 85, "hp_b": 65, "tx": "...", "commentary_audio": "<base64-mp3>" }
{ "type": "sensor_update", "robot_a": {"hp": 85, "position": {"x": -0.5, "y": 0.3}}, "robot_b": {...} }
{ "type": "match_over", "winner": "<pubkey>", "tx": "..." }
```

## On-Chain Program Instructions

| Instruction | Who calls | Effect |
|-------------|-----------|--------|
| `create_robot(name)` | Player | Mints robot PDA |
| `create_match(arena_id)` | Bridge authority | Opens a match |
| `report_damage(target, damage, description)` | Bridge authority | Deducts HP, emits `DamageEvent` |
| `advance_round()` | Bridge authority | Increments round counter |

---

Built for **Hack Dev3Pack** · Solana Devnet
