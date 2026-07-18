# ⚔️ Proof of Battle

> *Voice-commanded robot battles, arbitrated on-chain.*

An AI-powered robot combat platform where players register fighters on Solana, command them using natural language via a mobile app, and every hit is recorded as an immutable on-chain transaction. Spectators can bet SOL on the outcome and claim trustless payouts — no intermediary holds the funds.

**Built for Hack Dev3Pack.**

---

## Live Deployments

| Component | URL |
|---|---|
| Smart Contract (Devnet) | [`9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP`](https://explorer.solana.com/address/9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP?cluster=devnet) |
| Bridge API (Railway) | `https://proofofbattle-production.up.railway.app` |
| Bridge Docs | [`/docs`](https://proofofbattle-production.up.railway.app/docs) |

---

## The Problem

Online combat games and betting platforms share a structural flaw: **whoever controls the server controls the outcome**. Scores can be manipulated, payouts withheld, or the entire platform can disappear overnight. Players have no guarantee the rules were applied correctly.

## The Solution

Proof of Battle uses Solana as an impartial referee. Every robot hit, every HP change, and every battle result is written on-chain by a program that cannot be edited or overridden. The prize vault is a PDA — no admin key, no withdrawal until the program declares a winner.

---

## How It Works

```
[Commander — Mobile App]          [Spectators / Bettors — Mobile App]
         │                                      │
  Speaks a voice command                  Bet SOL on a robot
         │                                      │
         └──────────────────┬───────────────────┘
                            │ WebSocket
                            ▼
               ┌────────────────────────┐
               │   Bridge  (Railway)    │
               │                        │
               │ 1. ElevenLabs STT      │  transcribes voice → text
               │ 2. ARES (G.A.M.E. AI)  │  text + sensors → action JSON
               │ 3. Solana service      │  signs & sends on-chain tx
               │ 4. ElevenLabs TTS      │  generates audio commentary
               └──────────┬─────────────┘
                          │ TCP / WebSocket (Cloudflare Tunnel)
                          ▼
               ┌────────────────────────┐
               │   Webots Simulation    │
               │                        │
               │  Two robots with       │
               │  motors, GPS, compass  │
               │  and touch sensors     │
               │                        │
               │  Collision detection   │
               │  → emits events        │
               └────────────────────────┘
                          │ WebSocket broadcast
                          ▼
               ┌────────────────────────┐
               │  All connected clients │
               │  • Live HP bars        │
               │  • Color-coded event   │
               │    feed (last 30)      │
               │  • Audio commentary    │
               │  • Solana tx proof     │
               └────────────────────────┘
```

---

## Project Structure

```
ProofOfBattle/
├── on-chain/                         # Anchor smart contract (Rust)
│   ├── programs/proof-of-battle/
│   │   └── src/lib.rs                # 7 instructions + events + errors
│   └── Anchor.toml                   # deployed to Solana Devnet
│
├── bridge/                           # Python orchestration hub (Railway)
│   ├── main.py                       # FastAPI + WebSocket server
│   ├── ws_bridge.py                  # WebSocket → TCP proxy for Webots
│   ├── config.py                     # Pydantic settings
│   ├── agents/
│   │   └── battle_agent.py           # ARES — Virtuals G.A.M.E. V2 SDK
│   └── services/
│       ├── elevenlabs.py             # STT (Scribe v1) + TTS (Turbo v2.5)
│       ├── solana.py                 # Transaction signing via anchorpy
│       └── webots.py                 # TCP / WebSocket sim client
│
├── simulation/                       # Webots robot battle world
│   ├── worlds/arena.wbt
│   └── controllers/robot_controller/
│       └── robot_controller.py       # Supervisor: motors, sensors, TCP
│
├── pob-mobile/                       # Android app (Expo / React Native)
│   ├── app/
│   │   ├── index.tsx                 # Splash / wallet connect
│   │   ├── home.tsx                  # Live arenas + robot card + filters
│   │   ├── robot.tsx                 # Register & manage robot on-chain
│   │   ├── compete.tsx               # Create competition + robot picker
│   │   ├── leaderboard.tsx           # Global rankings with W/L records
│   │   ├── history.tsx               # Personal battle history
│   │   └── battle/[id].tsx           # Live battle view + commander panel
│   ├── components/
│   │   ├── CommandPanel.tsx          # Voice PTT + quick-command chips
│   │   ├── BetPanel.tsx              # Place SOL bets via MWA
│   │   ├── ClaimPanel.tsx            # Claim winnings after battle
│   │   └── Toast.tsx                 # In-app notification toasts
│   ├── hooks/
│   │   ├── useWallet.native.ts       # MWA transact() + authorize()
│   │   ├── useBattle.ts              # WS event feed, auto-reconnect
│   │   ├── useSeekerWs.ts            # Commander WebSocket channel
│   │   └── useRobot.ts               # Fetch robot PDA state
│   ├── lib/program.ts                # Borsh serialization + PDA helpers
│   └── assets/                       # icon.png, adaptive-icon.png, splash.png
│
└── app/                              # React web viewer (Vite)
    └── src/
        ├── views/
        │   ├── StreamBrowser.tsx     # Live arena list + filters + notifications
        │   ├── RobotRegister.tsx     # Robot registration form
        │   ├── CreateCompetition.tsx # Competition creation with robot picker
        │   ├── Leaderboard.tsx       # Global rankings
        │   └── History.tsx           # Personal battle history
        ├── components/               # HealthBar, Arena, BettingPanel, VoiceControl
        └── hooks/useWebSocket.ts
```

---

## Features

### Competition Management
Creators open a competition from the mobile app or web, set a name, location, and pick their robots (auto-filled from their registered profile or by searching another wallet). The lobby shows a **WAITING** status until the creator taps **⚔ INICIAR BATALLA**, which atomically registers both robots on-chain and transitions the battle to **ACTIVE**.

### Robot Profiles & Stats
Every robot is registered with three combat attributes — **ATK · DEF · SPD** — and optional category tags (SUMO, COMBAT, LINE FOLLOW, etc.). Stats are stored in the bridge profile and mirrored to the on-chain PDA. The arena view shows a mirrored stat bar comparison between both combatants before and during the fight.

### Live Arenas & Filters
The arena browser polls every 5 seconds and lets users filter by **ALL / LIVE / WAIT / ENDED** with live count badges. Each card shows the competition name, location, team members (if a team battle), viewer count, and status.

### Leaderboard
Global robot rankings sorted by wins. Each entry shows W/L record, win rate, stat bars, and category chips. On-chain W/L data is merged from the robot PDA via anchorpy — bridge falls back to cached data when in mock mode.

### Battle History
Users can view every competition they created, with combatant names, stats, and status. Active battles can be joined; finished battles can be replayed. Accessible via the **📜 HIST** tab (web) or the **📜** button in the mobile arena browser header.

### Push Notifications
**Web:** The stream browser detects when a followed competition transitions `waiting → active` and fires a browser `Notification`. A **🔔 ALERTS** button requests permission — once granted, users see **🔔 ON**.

**Mobile:** The same polling loop calls an in-app toast (`⚔ {name} is now LIVE!`) when any competition goes live — no OS permissions required.

### Share Battle Link
**Web:** A **⤴ SHARE** button inside the arena view calls `navigator.share()` on supported browsers; falls back to clipboard copy with a **✓ COPIED** confirmation.

**Mobile:** A **⤴ SHARE** button in the battle screen header calls the native `Share.share()` sheet with a direct arena URL.

---

## On-Chain Program

**Deployed:** [`9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP`](https://explorer.solana.com/address/9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP?cluster=devnet) · Solana Devnet

| Instruction | Description |
|---|---|
| `register_robot` | Create a robot PDA with name, attack, defense, speed |
| `create_battle` | Open a battle and a SOL vault PDA for bets |
| `place_bet` | Lock SOL in the vault — inaccessible until battle resolves |
| `start_battle` | Transition `Waiting → Active`, closes betting |
| `report_damage` | Record a hit on-chain, deduct HP (bridge authority) |
| `resolve_battle` | Declare winner, update robot W/L records |
| `claim_winnings` | Winning bettors claim proportional payout (95 % of pool) |

Payout formula: `(your_bet / winning_pool) × total_pool × 0.95` — calculated on-chain, no off-chain math.

---

## Bridge API

| Endpoint | Description |
|---|---|
| `POST /api/competition` | Register a new competition |
| `GET /api/competitions` | List all competitions |
| `GET /api/competition/{id}` | Get competition metadata (robot names, stats) |
| `POST /api/competition/{id}/start` | One-click start: registers robots + activates battle |
| `POST /api/robot-profile` | Save robot profile (ATK/DEF/SPD + categories) |
| `GET /api/robot-profile/{owner}` | Get profile by wallet address |
| `GET /api/leaderboard` | Ranked list merged with on-chain W/L data |
| `GET /api/battles/history/{owner}` | Competitions created by a wallet |
| `GET /match/{id}` | Live on-chain match state |

---

## Integrations

### Solana Mobile Stack
All on-chain actions go through MWA `transact()` — the wallet app (Phantom / Solflare) signs, the app never touches private keys.

| Flow | File |
|---|---|
| Wallet connect | `hooks/useWallet.native.ts` |
| Register robot | `app/robot.tsx` |
| Place bet | `components/BetPanel.tsx` |
| Claim winnings | `components/ClaimPanel.tsx` |

### Virtuals Protocol — G.A.M.E. SDK V2
**ARES** is the tactical AI agent running inside the bridge. It receives the transcribed voice command plus live sensor data (HP, enemy distance, position, heading) and returns exactly one action JSON.

- SDK: `game-sdk` · API: `sdk.game.virtuals.io/v2`
- Key format: `apt-...` (from [console.game.virtuals.io](https://console.game.virtuals.io))
- Per-robot persistent `Chat` sessions accumulate battle context across commands
- Fallback chain: G.A.M.E. SDK → V1 HTTP → deterministic rule engine

### ElevenLabs
| Feature | Model | Usage |
|---|---|---|
| Speech to Text | `scribe_v1` | Transcribes commander voice → action text |
| Text to Speech | `eleven_turbo_v2_5` | Generates dramatic commentary after each hit |

---

## WebSocket Protocol

### Commander → Bridge `/ws/seeker/{arena_id}`
```json
{ "type": "voice_text",  "text": "Attack!",        "robot_id": "robot_a" }
{ "type": "voice_audio", "audio": "<base64-webm>", "robot_id": "robot_a" }
```

### Bridge → All clients `/ws/arena/{arena_id}`
```json
{ "type": "damage",      "attacker": "robot_a", "target": "robot_b",
  "damage": 15, "hp_a": 85, "hp_b": 70,
  "tx": "<solana-sig>",  "commentary_audio": "<base64-mp3>" }

{ "type": "robot_action", "robot_id": "robot_a",
  "action": { "action": "attack", "intensity": 1.0, "reason": "Enemy in range" } }

{ "type": "sensor_update", "robot_a": { "hp": 85, "position": { "x": 0.3, "y": -0.1 } },
  "robot_b": { "hp": 70, "position": { "x": -0.2, "y": 0.4 } } }

{ "type": "match_over", "winner": 0, "winner_label": "robot_a", "tx": "..." }

{ "type": "battle_started", "battle_id": 1,
  "robot_a": "UNIT_ALPHA", "robot_b": "UNIT_BETA" }
```

---

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs) + [Solana CLI](https://release.anza.xyz/stable/install)
- [Anchor 1.0.2](https://www.anchor-lang.com/docs/installation)
- Python 3.11+
- [Webots R2023b](https://cyberbotics.com)
- Node 18+ / Expo CLI / EAS CLI

---

### 1 · Smart Contract

```bash
cd on-chain
anchor build
anchor deploy --provider.cluster devnet
```

Already deployed at `9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP`.

---

### 2 · Bridge

```bash
cd bridge
cp .env.example .env   # fill in keys — see Environment Variables below
pip install -r requirements.txt
python main.py
# → http://localhost:8000/docs
```

---

### 3 · Simulation + Cloudflare Tunnel (for Railway)

```bash
# One-time: download cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o cloudflared && chmod +x cloudflared
```

Each time you want to run a battle:

```bash
# Terminal 1 — open Webots and press Play (starts TCP on :5005)

# Terminal 2 — WebSocket bridge
python bridge/ws_bridge.py

# Terminal 3 — Cloudflare Tunnel
./cloudflared tunnel --url http://localhost:5006
# → copy the *.trycloudflare.com URL

# Set in Railway → Variables:
# WEBOTS_WS_URL=wss://your-url.trycloudflare.com
```

---

### 4 · Mobile App (Android APK)

```bash
cd pob-mobile
npm install
eas build --platform android --profile preview
```

Or run locally with Expo Go:

```bash
npx expo start
```

Requires Phantom or Solflare installed from Google Play to connect a wallet.

---

### 5 · Start a Battle

```bash
# Register robots and open the battle
curl -X POST https://proofofbattle-production.up.railway.app/admin/setup

# Transition Waiting → Active
curl -X POST https://proofofbattle-production.up.railway.app/admin/battle/1/start
```

Or use the in-app **⚔ INICIAR BATALLA** button (visible only to the competition creator).

---

## Environment Variables

### `bridge/.env`

```env
# ElevenLabs
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=onwK4e9ZLuTAKqWW03F9

# Virtuals Protocol G.A.M.E. (https://console.game.virtuals.io)
VIRTUALS_API_KEY=apt-your_game_api_key_here

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP
BRIDGE_KEYPAIR_JSON=[12,34,...]   # or use BRIDGE_KEYPAIR_PATH

# Webots — Option A: direct TCP (local)
WEBOTS_HOST=127.0.0.1
WEBOTS_PORT=5005

# Webots — Option B: Cloudflare Tunnel (Railway)
WEBOTS_WS_URL=wss://your-url.trycloudflare.com
```

### `pob-mobile` (EAS build profiles)

Set `EXPO_PUBLIC_BRIDGE_URL` in `eas.json` or as an EAS secret:

```
https://proofofbattle-production.up.railway.app
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust · Anchor 1.0.2 · Solana Devnet |
| AI Tactical Agent | Virtuals Protocol G.A.M.E. SDK V2 (ARES) |
| Voice In | ElevenLabs STT — Scribe v1 |
| Voice Out | ElevenLabs TTS — Turbo v2.5 |
| Simulation | Webots R2023b |
| Bridge | Python · FastAPI · WebSockets — Railway |
| Tunnel | Cloudflare Tunnel (ws_bridge.py) |
| Mobile | React Native · Expo · Solana Mobile Wallet Adapter v2 |
| APK Build | EAS Build |
| Web UI | React · Vite · TypeScript · Tailwind CSS |
