# ⚔️ Proof of Battle

> *Voice-commanded robot battles, arbitrated on-chain.*

An AI-powered robot combat arena where players command their robots using natural language, an autonomous AI agent translates commands into physical actions, and every hit is recorded immutably on Solana.

**Built for Hack Dev3Pack · Virtuals Protocol — Best AI Agent into Physical World**

---

## Live Deployments

| Component | URL |
|---|---|
| Smart Contract (Devnet) | [`9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP`](https://explorer.solana.com/address/9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP?cluster=devnet) |
| Bridge API | `https://stunning-space-disco-xqqp4wqp55gc9qv9-8000.app.github.dev` |
| Bridge Docs | [`/docs`](https://stunning-space-disco-xqqp4wqp55gc9qv9-8000.app.github.dev/docs) |

---

## What It Does

1. **Player speaks** — *"Attack! Go left! Boost!"* into the Seeker mobile app
2. **ElevenLabs** transcribes the voice command in real-time
3. **ARES AI Agent** reads the command + live sensor data (HP, enemy distance, position) and decides the optimal robot action
4. **Webots** simulation executes the action — motors move, collisions trigger
5. **Every collision** is signed and recorded on Solana as an on-chain transaction
6. **ElevenLabs TTS** generates dramatic live commentary after each hit
7. The **Seeker app** receives HP updates, audio commentary, and transaction proofs

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PROOF OF BATTLE                             │
│                                                                     │
│  📱 Seeker App          🐍 Bridge (Python)       🤖 Webots Sim       │
│  ┌──────────┐           ┌─────────────┐          ┌──────────────┐  │
│  │ Voice    │──voice──▶ │ ElevenLabs  │          │ Robot Arena  │  │
│  │ command  │           │   STT       │          │              │  │
│  │          │           │      │      │          │              │  │
│  │          │           │  ARES Agent │◀─sensors─│ Distance     │  │
│  │          │           │  (AI+rules) │──action─▶│ Motors       │  │
│  │          │◀─events── │      │      │          │ Collision    │  │
│  │ HP bars  │           │ Solana svc  │◀─impact──│ Detection    │  │
│  │ Audio    │           └─────┬───────┘          └──────────────┘  │
│  │ Tx proof │                 │ sign & send tx                     │
│  └──────────┘           ┌─────▼───────┐                            │
│                         │  ⛓ Solana   │                            │
│                         │   Devnet    │                            │
│                         │ on-chain HP │                            │
│                         └─────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
ProofOfBattle/
├── on-chain/                        # Anchor 1.0.2 smart contract
│   ├── programs/proof-of-battle/
│   │   └── src/lib.rs               # register_robot, create_battle,
│   │                                #   place_bet, report_damage,
│   │                                #   resolve_battle, claim_winnings
│   └── Anchor.toml                  # deployed to Solana Devnet
│
├── bridge/                          # Python orchestration hub
│   ├── main.py                      # FastAPI + WebSocket server
│   ├── agents/battle_agent.py       # ARES AI — decides robot actions
│   └── services/
│       ├── elevenlabs.py            # STT transcription + TTS commentary
│       ├── solana.py                # Transaction signing (anchorpy)
│       └── webots.py                # Simulation socket client
│
├── simulation/                      # Webots robot battle world
│   ├── worlds/arena.wbt
│   └── controllers/robot_controller/robot_controller.py
│
├── pob-mobile/                      # React Native (Expo) Seeker app
│   ├── app/index.tsx                # Battle screen
│   └── components/                  # HPBar, BetPanel, WalletButton
│
└── app/                             # React web Seeker UI (fallback)
    └── src/
        ├── components/              # HealthBar, Arena, VoiceControl
        └── hooks/useWebSocket.ts
```

---

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs) + [Solana CLI](https://release.anza.xyz/stable/install)
- [Anchor 1.0.2](https://www.anchor-lang.com/docs/installation) via AVM
- Python 3.11+
- [Webots R2023b](https://cyberbotics.com)
- Node 18+ / Expo CLI

### 1 · Smart Contract

```bash
cd on-chain
anchor build
anchor program deploy --provider.cluster devnet
```

Program already deployed at `9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP`.

### 2 · Bridge

```bash
cd bridge
cp .env.example .env      # add ELEVENLABS_API_KEY
pip install -r requirements.txt
python main.py
# → http://localhost:8000/docs
```

### 3 · Simulation

1. Install [Webots R2023b](https://cyberbotics.com)
2. Open `simulation/worlds/arena.wbt`
3. Press **Play** — controller auto-connects to the bridge on port `5005`

### 4 · Mobile App

```bash
cd pob-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone.

### 5 · Initialize a Battle

```bash
curl -X POST http://localhost:8000/admin/setup
curl -X POST http://localhost:8000/admin/battle/1/start
```

---

## On-Chain Program

**Deployed:** [`9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP`](https://explorer.solana.com/address/9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP?cluster=devnet) · Solana Devnet

| Instruction | Description |
|---|---|
| `register_robot` | Mint a robot PDA with attack/defense/speed stats |
| `create_battle` | Open a battle and vault for bets |
| `place_bet` | Bet SOL on a robot — locked until battle resolves |
| `start_battle` | Transition Waiting → Active, closes betting |
| `report_damage` | Record a hit on-chain, deduct HP |
| `resolve_battle` | Declare winner, update robot W/L record |
| `claim_winnings` | Winners claim proportional payout from vault |

---

## WebSocket Protocol

### Seeker → Bridge — `/ws/seeker/{arena_id}`
```json
{ "type": "voice_text", "text": "Attack!", "robot_id": "robot_a" }
{ "type": "voice_audio", "audio": "<base64-webm>", "robot_id": "robot_a" }
```

### Bridge → UI — `/ws/arena/{arena_id}`
```json
{ "type": "damage", "attacker": "robot_a", "target": "robot_b",
  "damage": 15, "hp_a": 85, "hp_b": 70,
  "tx": "<solana-signature>", "commentary_audio": "<base64-mp3>" }

{ "type": "robot_action", "robot_id": "robot_a",
  "action": { "action": "attack", "intensity": 1.0, "reason": "Enemy in range" } }

{ "type": "match_over", "winner": 0, "winner_label": "robot_a", "tx": "..." }
```

---

## Environment Variables

### `bridge/.env`
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP
BRIDGE_KEYPAIR_PATH=~/.config/solana/id.json
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=onwK4e9ZLuTAKqWW03F9
WEBOTS_HOST=127.0.0.1
WEBOTS_PORT=5005
```

### `app/.env`
```env
VITE_BRIDGE_URL=ws://localhost:8000
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust · Anchor 1.0.2 · Solana Devnet |
| AI Agent | Rule engine + Virtuals Protocol fallback |
| Voice | ElevenLabs STT (Scribe v1) + TTS (Turbo v2.5) |
| Simulation | Webots R2023b |
| Bridge | Python · FastAPI · WebSockets |
| Mobile | React Native · Expo · Solana Mobile Wallet Adapter |
| Web UI | React · Vite · TypeScript |
