import { Link } from "react-router-dom";
import aresMecha from "../assets/ares-mecha.jpg";
import { LoadingScreen } from "../components/LoadingScreen";
import { PageFrame } from "../components/PageFrame";

const tickerItems = [
  "[TX] 4p9z...x7qL → goal_scored (ARN_01 · team_b)",
  "[TX] 8k2v...m9wP → push_out (ARN_02 · FENRIS_V3)",
  "[TX] 1n5x...r3tY → claim_winnings (2.4 SOL)",
  "[TX] 7c3a...k8zN → register_robot (LINEBOT_07)",
  "[TX] 2b6q...j4hM → place_bet (0.5 SOL · ARN_05)",
  "[TX] 9pq1...d2eA → resolve_battle (winner: robot_a)",
  "[TX] 5h8w...t1cV → lap_recorded (ARN_04 · 11.32s)",
];

const instructions = [
  { name: "register_robot", desc: "Create robot PDA with name, attack, defense, speed.", auth: "User Signed", muted: true },
  { name: "create_battle", desc: "Open a battle and SOL vault PDA for backing.", auth: "User Signed", muted: true },
  { name: "place_bet", desc: "Lock SOL into the vault — inaccessible until resolution.", auth: "Open to Public", muted: true },
  { name: "start_battle", desc: "Transition Waiting → Active, closes backing window.", auth: "User Signed", muted: true },
  { name: "report_damage", desc: "Deduct HP from targets based on Webots collision sensors.", auth: "Bridge Authority", muted: false },
  { name: "resolve_battle", desc: "Declare winner, update robot W/L records on-chain.", auth: "Program Logic", muted: false },
  { name: "claim_winnings", desc: "Trustless payout — (your_back / winning_pool) × pool × 0.95.", auth: "Winner Signed", muted: true },
];

const competitions = [
  { code: "ARN_01", name: "Robot Soccer", spec: "5v5 · autonomous · IR ball tracking", desc: "Two teams of wheeled bots track an infrared ball across a felt pitch. Tactical AI calls plays; on-chain ledger records every goal.", status: "OPEN" },
  { code: "ARN_02", name: "Minisumo · Autonomous", spec: "500g · 10×10cm · dohyo Ø77cm", desc: "Two autonomous bots push each other off a circular ring. Edge sensors, opponent radar, and three-second start delay — all sensor traces hashed on-chain.", status: "OPEN" },
  { code: "ARN_03", name: "Minisumo · Bluetooth", spec: "500g · human-piloted · low latency", desc: "Commander mode. The mobile app pilots the bot over BLE while voice commands trigger maneuvers transcribed by ElevenLabs Scribe.", status: "LIVE" },
  { code: "ARN_04", name: "Line Followers", spec: "PID · 1m/s+ · 19mm black tape", desc: "Speed-run track with hairpin turns and forks. Lap times and crash events are signed and posted by the arena bridge.", status: "OPEN" },
  { code: "ARN_05", name: "Bugs Racer", spec: "vibration bots · 4-lane drag strip", desc: "Chaotic micro-bots powered by offset motors race a straight 1.5m strip. Finish-line laser gates settle backing in under three seconds.", status: "QUALIFYING" },
  { code: "ARN_06", name: "ARES Combat", spec: "simulated · Webots R2023b", desc: "The flagship: voice-commanded mechs in a physics-accurate sim. Every collision is an Anchor instruction; every kill is final.", status: "FEATURED" },
];

const repoComponents = [
  { num: "01", tag: "Mobile", title: "Seeker App", desc: "React Native (Expo Router) commander & spectator app. Signs every transaction with Solana Mobile Wallet Adapter v2 — the app never touches private keys.", spec: "pob-mobile/ · Expo 54 · MWA v2" },
  { num: "02", tag: "Bridge", title: "Python Bridge", desc: "FastAPI + WebSocket service. Transcribes voice via ElevenLabs, runs the ARES tactical agent, and relays signed instructions to Solana and Webots.", spec: "bridge/ · FastAPI · WebSockets" },
  { num: "03", tag: "Simulation", title: "Webots Arena", desc: "Physics-accurate robot simulation. Motors, GPS, compass and touch sensors emit collision events consumed by the bridge.", spec: "simulation/ · Webots R2023b" },
  { num: "04", tag: "On-Chain", title: "Anchor Program", desc: "Rust program governing robot PDAs, battle vaults and trustless payouts — no admin key, no off-chain math.", spec: "on-chain/ · Anchor 1.0.2" },
];

export function MarketingLanding() {
  return (
    <>
      <LoadingScreen />
      <PageFrame />
      <main className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        {/* Top status / ticker */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between gap-4 px-6 h-12">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-primary font-mono text-[10px] font-bold tracking-widest uppercase whitespace-nowrap flex-shrink-0">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                Operational
              </span>
              <div className="hidden md:block h-3 w-px bg-border flex-shrink-0" />
              <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-muted uppercase tracking-wide min-w-0 flex-1">
                <span className="text-primary/70 whitespace-nowrap flex-shrink-0">Live devnet feed</span>
                <div
                  className="overflow-hidden flex-1"
                  style={{
                    maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                    WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                  }}
                >
                  <div className="flex gap-10 animate-ticker whitespace-nowrap w-max">
                    {[...tickerItems, ...tickerItems].map((t, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <span className="text-muted/50">›</span>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="font-mono text-[10px] text-muted hidden lg:block whitespace-nowrap">
                9MFZt...MxCP
              </span>
              <Link
                to="/app"
                className="border border-primary/60 text-primary font-mono text-[10px] px-3 py-1.5 uppercase font-bold tracking-widest hover:bg-primary/10 transition-all whitespace-nowrap flex-shrink-0"
              >
                Launch App →
              </Link>
            </div>
          </div>
        </nav>

        {/* HERO — cockpit HUD */}
        <section className="relative overflow-hidden border-b border-border scanline-effect bg-[#04060F]">
          {/* Background mecha */}
          <div className="absolute inset-0">
            <img
              src={aresMecha}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#04060F] via-[#04060F]/40 to-[#04060F]" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#04060F] via-transparent to-[#04060F]" />
            <div
              className="absolute inset-0 opacity-[0.07] mix-blend-screen"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(110,168,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(110,168,255,0.6) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>

          {/* Cockpit frame corners */}
          <div className="pointer-events-none absolute top-6 left-6 size-8 border-l-2 border-t-2 border-primary" />
          <div className="pointer-events-none absolute top-6 right-6 size-8 border-r-2 border-t-2 border-[color:var(--color-secondary)]" />
          <div className="pointer-events-none absolute bottom-6 left-6 size-8 border-l-2 border-b-2 border-[color:var(--color-secondary)]" />
          <div className="pointer-events-none absolute bottom-6 right-6 size-8 border-r-2 border-b-2 border-primary" />

          {/* HUD top bar */}
          <div className="relative z-10 flex justify-between items-center px-8 pt-8 text-[10px] font-mono uppercase tracking-widest">
            <div className="flex items-center gap-3">
              <span className="size-2 bg-primary rounded-full animate-pulse" />
              <span className="text-primary">REC // ARENA_FEED</span>
            </div>
            <div className="flex items-center gap-4 text-muted">
              <span className="hidden sm:inline">LAT 19.43°N</span>
              <span className="hidden sm:inline">LON 99.13°W</span>
              <span className="text-[color:var(--color-secondary)]">DEVNET ONLINE</span>
            </div>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32 text-center">
            <div className="mb-8 inline-flex items-center gap-3 border border-primary/40 px-3 py-1.5">
              <span className="size-1.5 bg-primary rounded-full" />
              <span className="text-primary font-mono text-[10px] tracking-[0.3em] uppercase">
                Build on Solana
              </span>
            </div>

            <h1 className="font-black tracking-tighter leading-[0.82] uppercase text-balance">
              <span className="block text-[clamp(3rem,11vw,9rem)]">Proof of</span>
              <span className="block text-[clamp(3.5rem,13vw,11rem)] bg-gradient-to-r from-primary via-white to-[color:var(--color-secondary)] bg-clip-text text-transparent">
                Battle
              </span>
            </h1>

            <p className="mt-10 mx-auto max-w-[60ch] text-base md:text-lg text-muted font-medium leading-relaxed">
              The on-chain arena for robotics. Soccer bots, minisumo, line followers, bugs racers
              and full-physics mech combat — every match refereed by Solana, every result final.
            </p>

            <div className="mt-12 flex flex-wrap gap-3 justify-center">
              <Link
                to="/app"
                className="bg-primary text-white font-mono text-xs px-8 py-4 uppercase font-bold tracking-widest hover:brightness-110 transition-all cursor-pointer shadow-[0_0_40px_rgba(255,45,74,0.45)]"
              >
                Enter Arena ▸
              </Link>
              <a
                href="https://explorer.solana.com/address/9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP?cluster=devnet"
                target="_blank"
                rel="noreferrer"
                className="border border-[color:var(--color-secondary)]/60 text-[color:var(--color-secondary)] font-mono text-xs px-8 py-4 uppercase font-bold tracking-widest hover:bg-[color:var(--color-secondary)]/10 transition-all cursor-pointer"
              >
                View Contract
              </a>
            </div>

            {/* HUD vitals strip */}
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border max-w-4xl mx-auto text-left">
              {[
                { k: "Arenas Live", v: "06", c: "primary" },
                { k: "Robots Registered", v: "142", c: "secondary" },
                { k: "Pool Locked", v: "38.4 SOL", c: "primary" },
                { k: "Battles Resolved", v: "881", c: "secondary" },
              ].map((s) => (
                <div key={s.k} className="bg-[#04060F]/80 backdrop-blur-sm p-5">
                  <div className="text-[9px] font-mono text-muted uppercase tracking-widest mb-2">{s.k}</div>
                  <div className={`font-mono text-2xl font-black ${s.c === "primary" ? "text-primary" : "text-[color:var(--color-secondary)]"}`}>
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HUD bottom bar */}
          <div className="relative z-10 flex justify-between items-center px-8 pb-6 text-[10px] font-mono uppercase tracking-widest text-muted">
            <span>SYS_VISUAL_01 // ARES_MKIV</span>
            <span className="text-primary">▾ TAP TO EXPLORE</span>
          </div>
        </section>

        {/* PROBLEM / SOLUTION */}
        <section className="px-6 py-24 border-b border-border">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
            <div className="bg-background p-10 border-l-2 border-l-primary">
              <span className="font-mono text-xs text-primary uppercase tracking-widest">[ 01 ] Problem</span>
              <h2 className="mt-4 text-2xl font-black tracking-tight uppercase">Robot competitions die at the scoring table.</h2>
              <p className="mt-4 text-muted leading-relaxed">
                Soccer goals get waved off. Minisumo edges get disputed. Line-follower lap times rely on
                someone's stopwatch. Prizes vanish, brackets get rewritten — and the organizer always wins.
              </p>
            </div>
            <div className="bg-background p-10 border-l-2 border-l-[color:var(--color-secondary)]">
              <span className="font-mono text-xs text-[color:var(--color-secondary)] uppercase tracking-widest">[ 02 ] Solution</span>
              <h2 className="mt-4 text-2xl font-black tracking-tight uppercase">Solana as the impartial referee.</h2>
              <p className="mt-4 text-muted leading-relaxed">
                Every goal, push-out, lap time and KO is signed by an arena bridge and written on-chain by
                an Anchor program no admin can override. The prize vault is a PDA — payouts unlock only
                when the program declares a winner.
              </p>
            </div>
          </div>
        </section>

        {/* COMPETITIONS / ARENAS */}
        <section id="arenas" className="relative px-6 py-28 border-b border-border bg-[#04060F] overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.05] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,45,74,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(45,123,255,0.6) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
            }}
          />
          <div className="relative max-w-7xl mx-auto">
            <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="font-mono text-xs text-primary mb-3 block uppercase tracking-[0.3em]">[ 03 ] Arenas</span>
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9]">
                  Six rings.<br />
                  <span className="text-[color:var(--color-secondary)]">One referee.</span>
                </h2>
              </div>
              <p className="text-muted max-w-[42ch] text-base leading-relaxed">
                From wheeled soccer squads to vibration-powered drag racers — every category
                shares the same trustless backbone. Pick your arena, sign your bot, fight for the pot.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
              {competitions.map((c, idx) => {
                const isFeatured = c.status === "FEATURED";
                const accent = idx % 2 === 0 ? "var(--color-primary)" : "var(--color-secondary)";
                return (
                  <div
                    key={c.code}
                    className="group relative bg-[#06080F] p-7 flex flex-col gap-5 hover:bg-[#0A0E1F] transition-all duration-300"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-px opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ background: accent }}
                    />
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{c.code}</span>
                      <span
                        className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border"
                        style={{
                          color: isFeatured ? "var(--color-primary)" : c.status === "LIVE" ? "var(--color-secondary)" : "var(--color-muted)",
                          borderColor: isFeatured ? "var(--color-primary)" : c.status === "LIVE" ? "var(--color-secondary)" : "var(--color-border)",
                        }}
                      >
                        ● {c.status}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{c.name}</h3>
                    <p className="text-sm text-muted leading-relaxed flex-1">{c.desc}</p>
                    <div className="font-mono text-[10px] text-foreground/70 bg-[#04060F] border border-border p-3 uppercase tracking-wider">
                      SPEC // {c.spec}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-widest text-muted">
              <span>06 ARENAS // 1 REFEREE // 0 ADMINS</span>
              <span className="text-primary">▸ NEW CATEGORIES SHIPPING WEEKLY</span>
            </div>
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section className="px-6 py-24 bg-[#070708] border-b border-border">
          <div className="max-w-7xl mx-auto">
            <header className="mb-16">
              <span className="font-mono text-xs text-primary mb-2 block uppercase tracking-widest">[ 04 ] Architecture</span>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">System Pipeline</h2>
              <p className="mt-4 text-muted max-w-[60ch]">
                Voice command in. Tactical AI in the middle. Physical simulation. On-chain proof out.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-border border border-border">
              {[
                { n: "01", k: "INPUT", t: "Commander", d: "Natural language via ElevenLabs Scribe. Human voice transcribes to tactical commands.", s: "STT: scribe_v1" },
                { n: "02", k: "ARBITER", t: "Bridge", d: "ARES Tactical AI (Virtuals G.A.M.E. SDK) parses sensor data + voice and emits action JSON.", s: "SDK: G.A.M.E. V2" },
                { n: "03", k: "EXECUTION", t: "Simulation", d: "Webots physics engine handles real-time collision. Touch sensors emit damage events.", s: "ENGINE: Webots R2023b" },
                { n: "04", k: "RECORD", t: "Solana", d: "Every hit is an on-chain instruction. PDA vault manages trustless backing payouts.", s: "PROGRAM: Anchor 1.0.2" },
              ].map((c, idx) => {
                const accent = idx % 2 === 0 ? "text-primary" : "text-[color:var(--color-secondary)]";
                const bar = idx % 2 === 0 ? "border-t-primary" : "border-t-[color:var(--color-secondary)]";
                return (
                  <div key={c.n} className={`bg-background p-8 flex flex-col border-t-2 ${bar}`}>
                    <div className={`${accent} font-mono text-xs mb-6`}>{c.n} // {c.k}</div>
                    <h3 className="text-xl font-bold mb-4 uppercase">{c.t}</h3>
                    <p className="text-sm text-muted mb-6 leading-relaxed flex-1">{c.d}</p>
                    <div className="text-[10px] font-mono text-muted bg-zinc-900 p-2">{c.s}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PROGRAM MANIFEST */}
        <section className="px-6 py-24 border-b border-border">
          <div className="max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <span className="font-mono text-xs text-primary mb-2 block uppercase tracking-widest">[ 05 ] Instruction Set</span>
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Program Manifest</h2>
              </div>
              <div className="font-mono text-xs bg-zinc-900 border border-border p-4 max-w-full overflow-hidden">
                <div><span className="text-muted">NETWORK:</span> <span className="text-white">SOLANA DEVNET</span></div>
                <div className="truncate"><span className="text-muted">CONTRACT:</span> <span className="text-primary">9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP</span></div>
              </div>
            </header>

            <div className="overflow-x-auto border border-border">
              <table className="w-full border-collapse font-mono text-xs text-left">
                <thead>
                  <tr className="border-b border-border bg-zinc-950">
                    <th className="py-4 px-4 text-muted font-normal uppercase tracking-widest">Instruction</th>
                    <th className="py-4 px-4 text-muted font-normal uppercase tracking-widest">Description</th>
                    <th className="py-4 px-4 text-muted font-normal uppercase tracking-widest">Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {instructions.map((i) => (
                    <tr key={i.name} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-white font-bold">{i.name}</td>
                      <td className="py-4 px-4 text-muted">{i.desc}</td>
                      <td className={`py-4 px-4 ${i.muted ? "text-zinc-500" : "text-primary"}`}>{i.auth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-xs font-mono text-muted">
              PAYOUT: <span className="text-foreground">(your_back / winning_pool) × total_pool × 0.95</span> — calculated on-chain, no off-chain math.
            </p>
          </div>
        </section>

        {/* REPO COMPONENTS */}
        <section className="px-6 py-24 bg-[#070708] border-b border-border">
          <div className="max-w-7xl mx-auto">
            <header className="mb-16">
              <span className="font-mono text-xs text-primary mb-2 block uppercase tracking-widest">[ 06 ] Components</span>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Four Parts, One Referee</h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
              {repoComponents.map((i, idx) => {
                const accent = idx % 2 === 0 ? "text-primary" : "text-[color:var(--color-secondary)]";
                return (
                  <div key={i.num} className="bg-background p-8 flex flex-col gap-4">
                    <span className={`font-mono text-[10px] ${accent} uppercase tracking-widest`}>{i.num} / {i.tag}</span>
                    <h4 className="text-xl font-bold uppercase">{i.title}</h4>
                    <p className="text-sm text-muted leading-relaxed flex-1">{i.desc}</p>
                    <div className="text-[10px] font-mono text-muted bg-zinc-900 p-2 mt-2">{i.spec}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="px-6 py-12 bg-black">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="size-10 grid place-items-center bg-gradient-to-br from-primary to-[color:var(--color-secondary)]">
                <span className="text-black font-black text-lg uppercase">PB</span>
              </div>
              <div>
                <p className="font-black text-sm uppercase tracking-tighter">Proof of Battle</p>
                <p className="text-[10px] font-mono text-muted uppercase">Terminal Protocol · v0.1</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-mono text-muted uppercase mb-1">Built For</p>
                <p className="font-bold text-xs uppercase">Hack Dev3Pack</p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
