# ⚔️ Proof of Battle

> *Voice-commanded robot battles, arbitrated on-chain.*

An AI-powered robot combat platform where players register fighters on Solana, command them using natural language (or a hardware remote control for real robots) via a mobile app, and every hit is recorded as an immutable on-chain transaction. Spectators back a robot in SOL or USDC and claim trustless payouts — no intermediary holds the funds.

Battles come in two modes: **online** (simulated in Webots, driven by the AI tactical agent) and **physical** (real, ESP32-controlled robots refereed by a human, with an optional live stream for remote viewers).

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

### Online mode — simulated, voice-commanded

```
[Commander — Mobile App]          [Spectators / Backers — Mobile / Web App]
         │                                      │
  Speaks a voice command                Back a robot in SOL or USDC
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

### Physical mode — real robots, human-refereed, live-streamed

```
[Commander — Mobile App]                    [Referee — Mobile / Web App]
         │                                              │
  Presses D-pad / action buttons              Reports hits, declares winner
         │                                              │
         ▼                                              ▼
┌──────────────────────┐                    ┌────────────────────────────┐
│  ESP32 robot (local   │                    │  Bridge  (Railway)         │
│  WiFi access point)   │                    │  POST /report → handle_    │
│  — no bridge/internet │                    │  collision() (same path    │
│  round-trip, direct   │                    │  online mode uses)         │
│  WebSocket, ~8Hz       │                    │  POST /resolve → resolve_  │
│  press-and-hold, 500ms │                    │  battle() on-chain        │
│  watchdog stop         │                    └──────────────┬─────────────┘
└──────────────────────┘                                   │ WebSocket broadcast
                                                              ▼
                                              ┌────────────────────────────┐
                                              │  Spectators — Web app       │
                                              │  watch the referee's live   │
                                              │  stream (YouTube Live /     │
                                              │  Twitch link) alongside     │
                                              │  the same HP bars / backing │
                                              │  panel as online mode       │
                                              └────────────────────────────┘
```

---

## Project Structure

```
ProofOfBattle/
├── on-chain/                         # Anchor smart contract (Rust)
│   ├── programs/proof-of-battle/
│   │   └── src/lib.rs                # 9 instructions + events + errors
│   └── Anchor.toml                   # deployed to Solana Devnet
│
├── firmware/                         # ESP32 firmware for physical robots
│   └── robot-controller/
│       ├── robot-controller.ino      # WiFi AP + WebSocket RC receiver
│       └── README.md                 # flashing + pairing + safety notes
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
├── simulation/                       # Webots robot battle world (online mode)
│   ├── worlds/arena.wbt
│   └── controllers/robot_controller/
│       └── robot_controller.py       # Supervisor: motors, sensors, TCP
│
├── pob-mobile/                       # Android app (Expo / React Native)
│   ├── app/
│   │   ├── index.tsx                 # Splash / wallet connect
│   │   ├── home.tsx                  # Live arenas + robot card + filters
│   │   ├── robot.tsx                 # Register & manage robots on-chain (list + picker)
│   │   ├── compete.tsx               # Create competition — real robot picker, mode toggle
│   │   └── battle/[id].tsx           # Live battle view + commander / referee panel
│   ├── components/
│   │   ├── CommandPanel.tsx          # Online mode: voice PTT + quick-command chips
│   │   ├── HardwareControlPanel.tsx  # Physical mode: ESP32 remote control (D-pad, hold-to-send)
│   │   ├── RefereePanel.tsx          # Physical mode: report hits / declare winner
│   │   ├── BackPanel.tsx             # Back a robot in SOL or USDC via MWA
│   │   ├── ClaimPanel.tsx            # Claim winnings (SOL or USDC) after battle
│   │   └── Toast.tsx                 # In-app notification toasts
│   ├── hooks/
│   │   ├── useWallet.native.ts       # MWA transact() + authorize()
│   │   ├── useBattle.ts              # WS event feed, auto-reconnect
│   │   ├── useSeekerWs.ts            # Commander WebSocket channel (online mode)
│   │   ├── useRobotHardware.ts       # Direct local WebSocket to an ESP32 robot
│   │   └── useRobot.ts               # Fetch all of a wallet's robot PDAs + active selection
│   ├── lib/program.ts                # Borsh serialization + PDA helpers (SOL + SPL token)
│   └── assets/                       # icon.png, adaptive-icon.png, splash.png
│
└── app/                              # React web viewer (Vite)
    └── src/
        ├── views/
        │   ├── StreamBrowser.tsx     # Live arena list + filters + notifications
        │   ├── RobotRegister.tsx     # Robot registration + list of your robots
        │   ├── CreateCompetition.tsx # Real on-chain robot picker, mode toggle, stream link
        │   ├── Leaderboard.tsx       # Global rankings
        │   └── History.tsx          # Personal battle history
        ├── components/               # HealthBar, Arena, BackingPanel, RefereePanel, LiveStream, VoiceControl
        └── hooks/useWebSocket.ts
```

---

## Features

### Competition Management
Creators open a competition from the mobile app or web, set a name, location, mode (**online**/**physical**), and pick robot A from their own registered robots and robot B by searching any wallet. Creating a competition signs `create_battle` **from the creator's own wallet** — the on-chain program requires `robot_a.owner == creator`, so the battle is bound to a real, already-registered robot from the start, not a placeholder. The lobby shows **WAITING** until the creator taps **⚔ INICIAR BATALLA**, which transitions the battle to **ACTIVE** and closes backing.

### Multi-Robot Management
A wallet can register more than one robot (the on-chain PDA is scoped by `owner + name`). The robot screen (mobile) / register view (web) lists every robot you own, lets you mark one **ACTIVE**, and register more at any time — "which robot is mine" is resolved by scanning `getProgramAccounts` for your owner pubkey, not by guessing a single PDA.

### Robot Profiles & Stats
Every robot is registered with three combat attributes — **ATK · DEF · SPD** — and optional category tags (SUMO, COMBAT, LINE FOLLOW, etc.). Stats are stored in the bridge profile (keyed by `owner:name`, so multiple robots per wallet don't overwrite each other) and mirrored to the on-chain PDA. The arena view shows a mirrored stat bar comparison between both combatants before and during the fight.

### Online vs Physical Modes
- **Online**: the existing Webots-simulated flow — voice/text commands go to the ARES AI agent, which drives the virtual robots; damage and results are reported on-chain automatically.
- **Physical**: real, ESP32-controlled robots. The commander steers their robot from the mobile app's **Hardware Control Panel** over a direct local-WiFi WebSocket (no bridge round-trip — see *Hardware Remote Control* below). The creator referees the match from a **Referee Panel** (web or mobile): report a hit (`POST /api/competition/{id}/report`) or declare the winner (`POST /api/competition/{id}/resolve`), both of which call the *same* `handle_collision()`/`handle_match_over()` bridge functions the online/Webots path uses — physical mode is just a different input source into the identical on-chain reporting pipeline.

### Live Streaming (Physical Mode)
When creating a physical competition, the creator pastes a live stream link (YouTube Live or Twitch). The web arena view embeds it in place of the simulated Webots visualization, so remote spectators can watch the real match while backing and HP bars work exactly as they do in online mode.

### Hardware Remote Control (Physical Mode)
The mobile app's **Hardware Control Panel** connects directly to a robot's onboard ESP32 over its own local WiFi access point (`firmware/robot-controller/`) — see the [Hardware section](#hardware--esp32-robot-controller) below for firmware details, pairing, and safety notes.

### Backing in SOL or USDC
Spectators back a robot with a **free-entry amount** (no preset/default) in either **SOL** or **USDC** (devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). The two currencies are pooled completely separately on-chain (`place_bet`/`claim_winnings` for SOL, `place_bet_token`/`claim_winnings_token` for SPL tokens) so they never mix into one payout pool. Claiming auto-detects which currency you backed with.

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
| `register_robot` | Create a robot PDA (seeds: `owner + name` — one wallet can own several) |
| `create_battle` | Open a battle + SOL vault PDA. **Signed by the creator's own wallet** — requires `robot_a.owner == creator`, so `robot_a`/`robot_b` are real, already-registered robots |
| `place_bet` | Lock SOL in the vault — inaccessible until battle resolves |
| `place_bet_token` | Same as `place_bet`, for an SPL token (e.g. USDC) — pooled separately per mint via its own `BetToken`/vault-token PDAs |
| `start_battle` | Transition `Waiting → Active`, closes backing |
| `report_damage` | Record a hit on-chain, deduct HP (bridge authority — driven by Webots online, or by a human referee's `/report` call in physical mode) |
| `resolve_battle` | Declare winner, update robot W/L records |
| `claim_winnings` | Winning SOL backers claim proportional payout (95 % of pool) |
| `claim_winnings_token` | Same as `claim_winnings`, paid out in the SPL token that was backed |

Payout formula (identical for both currencies): `(your_back / winning_pool) × total_pool × 0.95` — calculated on-chain, no off-chain math.

---

## Bridge API

| Endpoint | Description |
|---|---|
| `POST /api/competition` | Register competition metadata (mode, stream URL, robot display info) — called **after** the creator's `create_battle` tx confirms on-chain |
| `GET /api/competitions` | List all competitions |
| `GET /api/competition/{id}` | Get competition metadata (mode, stream URL, robot names/stats, creator) |
| `POST /api/competition/{id}/start` | Creator-only: transitions `Waiting → Active`, closes backing |
| `POST /api/competition/{id}/report` | Physical-mode only, creator/referee: report a hit (`{side, damage}`) — calls the same `handle_collision()` the Webots path uses |
| `POST /api/competition/{id}/resolve` | Physical-mode only, creator/referee: declare the winner (`{winner}`) — calls `handle_match_over()` |
| `POST /api/robot-profile` | Save a robot profile (ATK/DEF/SPD + categories), keyed by `owner:name` |
| `GET /api/robot-profile/{owner}` | **Returns a list** — all robot profiles for that wallet (a wallet can own several) |
| `GET /api/leaderboard` | Ranked list merged with on-chain W/L data |
| `GET /api/battles/history/{owner}` | Competitions created by a wallet |
| `GET /match/{id}` | Live on-chain match state (HP, status, SOL + USDC backing totals) |

---

## Integrations

### Solana Mobile Stack
All on-chain actions go through MWA `transact()` — the wallet app (Phantom / Solflare) signs, the app never touches private keys.

| Flow | File |
|---|---|
| Wallet connect | `hooks/useWallet.native.ts` |
| Register / manage robots | `app/robot.tsx` |
| Create competition (client-signed `create_battle`) | `app/compete.tsx` |
| Back a robot (SOL or USDC) | `components/BackPanel.tsx` |
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

## Hardware — ESP32 Robot Controller

Physical-mode robots run the firmware in `firmware/robot-controller/`, which turns an ESP32 into a local, self-contained remote-control receiver for a real combat robot.

- **Own WiFi access point** (`POB-ROBOT-01` by default) — the phone connects to the robot's hotspot directly, no venue WiFi or internet dependency, minimizing control latency.
- **WebSocket server on port 81** parses the *same* `{"action": ..., "intensity": 0-100}` vocabulary `bridge/agents/battle_agent.py` already uses for the simulated robots (`forward`/`back`/`left`/`right`/`spin`/`attack`/`defend`/`stop`) — the command "language" is identical between online and physical mode, only the transport differs.
- **500ms safety watchdog**: if no command arrives in that window, motors force-stop — protects against a runaway robot if the phone disconnects or the app crashes mid-match. `pob-mobile`'s `HardwareControlPanel`/`useRobotHardware.ts` resends the held action at ~8Hz specifically to keep this fed.
- Motor pin mapping and PWM ranges in `robot-controller.ino` are placeholders for a generic dual H-bridge driver — see `firmware/robot-controller/README.md` for flashing instructions and what to adjust for your actual wiring before a real match.

**Pairing:** connect the phone to the robot's WiFi network in system settings, then open the Hardware Control Panel in the app (physical mode, as commander) — it defaults to `192.168.4.1`, the standard ESP32 AP address, so pairing is just tapping **CONNECT**.

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

The normal path is entirely in-app: create a competition (this signs `create_battle` with your own wallet, referencing your real registered robot), then tap **⚔ INICIAR BATALLA** (creator-only) once ready.

For quick admin/demo testing without the app, `/admin/setup` registers two bridge-owned placeholder robots and calls `create_battle` server-side instead:

```bash
# Demo/testing only — registers placeholder robots + opens the battle
curl -X POST https://proofofbattle-production.up.railway.app/admin/setup

# Transition Waiting → Active
curl -X POST https://proofofbattle-production.up.railway.app/admin/battle/1/start
```

### 6 · Physical Mode (real robots)

```bash
cd firmware/robot-controller
# Open robot-controller.ino in Arduino IDE, install the "WebSockets" and
# "ArduinoJson" libraries, adjust the motor pins to your H-bridge wiring,
# select your ESP32 board, and upload.
```

See `firmware/robot-controller/README.md` for pairing and safety details. Once flashed, create a **physical**-mode competition in the app, paste a live-stream link, and the commander's Hardware Control Panel will pair with the robot's WiFi hotspot.

---

## Environment Variables

### `bridge/.env`

```env
# ElevenLabs
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=onwK4e9ZLuTAKqWW03F9

# Virtuals Protocol G.A.M.E. (https://console.game.virtuals.io)
VIRTUALS_API_KEY=apt-your_game_api_key_here

# Solana — the public devnet RPC is heavily rate-limited and its
# confirmTransaction polling is unreliable under any load; use a dedicated
# provider (Helius, QuickNode, etc.) in anything beyond casual local testing.
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP
BRIDGE_KEYPAIR_JSON=[12,34,...]   # or use BRIDGE_KEYPAIR_PATH

# Webots — Option A: direct TCP (local)
WEBOTS_HOST=127.0.0.1
WEBOTS_PORT=5005

# Webots — Option B: Cloudflare Tunnel (Railway)
WEBOTS_WS_URL=wss://your-url.trycloudflare.com
```

### `pob-mobile` (EAS build profiles / `.env`)

```env
EXPO_PUBLIC_BRIDGE_URL=https://proofofbattle-production.up.railway.app
# Optional — same rate-limiting caveat as the bridge's SOLANA_RPC_URL above;
# defaults to the public devnet RPC if unset.
EXPO_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=your_key
```

### `app/.env` (web)

```env
# Must include the ws(s):// scheme explicitly, or it gets resolved as a path
# relative to the current page instead of the bridge's actual origin.
VITE_BRIDGE_URL=wss://proofofbattle-production.up.railway.app
# Optional — same rate-limiting caveat as above.
VITE_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=your_key
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust · Anchor 1.0.2 · anchor-spl · Solana Devnet |
| Token Backing | SPL Token / Associated Token Account (USDC, devnet mint) alongside native SOL |
| Robot Firmware | ESP32 (Arduino) · WebSockets (Links2004) · ArduinoJson |
| AI Tactical Agent | Virtuals Protocol G.A.M.E. SDK V2 (ARES) |
| Voice In | ElevenLabs STT — Scribe v1 |
| Voice Out | ElevenLabs TTS — Turbo v2.5 |
| Simulation | Webots R2023b |
| Bridge | Python · FastAPI · WebSockets — Railway |
| Tunnel | Cloudflare Tunnel (ws_bridge.py) |
| Live Streaming | External embed (YouTube Live / Twitch) — physical mode |
| Mobile | React Native · Expo · Solana Mobile Wallet Adapter v2 |
| APK Build | EAS Build |
| Web UI | React · Vite · TypeScript · Tailwind CSS |
