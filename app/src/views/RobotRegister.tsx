import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import { useProgram } from "../hooks/useProgram";
import { useRobots } from "../hooks/useRobot";
import { ROBOT_CATEGORIES } from "../types";
import { BRIDGE_HTTP_URL as BRIDGE_HTTP } from "../lib/bridge";
import { confirmWithTimeout } from "../lib/program";

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <span className="text-[7px] font-mono text-muted w-6">{label}</span>
      <div className="flex-1 h-1 bg-background rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[8px] font-mono w-5 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function StatSlider({
  label,
  value,
  onChange,
  accentColor,
  textClass,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
  textClass: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono tracking-widest text-muted uppercase">{label}</span>
        <span className={`text-[11px] font-black tabular-nums ${textClass}`}>{value}</span>
      </div>
      <div className="relative h-2 flex items-center">
        <div className="absolute inset-0 bg-surface rounded-full" />
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: accentColor, opacity: 0.7 }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-2 appearance-none bg-transparent cursor-pointer z-10"
          style={{ accentColor }}
        />
      </div>
    </div>
  );
}

export function RobotRegister() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useProgram();
  const { robots, selectedRobot, selectRobot, loading: robotsLoading, reload } = useRobots(publicKey);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [attack, setAttack] = useState(70);
  const [defense, setDefense] = useState(60);
  const [speed, setSpeed] = useState(65);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Open the form automatically the first time we learn this wallet has no robots yet.
  useEffect(() => {
    if (!robotsLoading && robots.length === 0) setFormOpen(true);
  }, [robotsLoading, robots.length]);

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleRegister = async () => {
    if (!connected) {
      setVisible(true);
      return;
    }
    if (!program || !publicKey || !signTransaction || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const ix = await (program.methods as unknown as {
        registerRobot: (name: string, attack: number, defense: number, speed: number) => {
          accounts: (a: object) => { instruction: () => Promise<import("@solana/web3.js").TransactionInstruction> };
        };
      })
        .registerRobot(name.trim(), attack, defense, speed)
        .accounts({ owner: publicKey })
        .instruction();

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const unsigned = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey }).add(ix);
      const signed = await signTransaction(unsigned);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await confirmWithTimeout(connection, sig, blockhash, lastValidBlockHeight);

      // Store profile in bridge (non-critical)
      fetch(`${BRIDGE_HTTP}/api/robot-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: publicKey.toBase58(),
          name: name.trim(),
          attack,
          defense,
          speed,
          categories,
        }),
      }).catch(() => {});

      setTx(sig);
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const total = attack + defense + speed;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 max-w-2xl mx-auto pb-24 md:pb-8">
      <div>
        <h2 className="text-sm font-black tracking-[0.3em] text-foreground uppercase">
          My Robots
        </h2>
        <p className="text-[9px] text-muted tracking-wider mt-0.5">
          A wallet can own several robots — pick which one is active.
        </p>
      </div>

      {/* Existing robots */}
      {connected && robotsLoading && (
        <p className="text-[9px] font-mono text-muted">◌ Loading your robots…</p>
      )}
      {connected && !robotsLoading && robots.length > 0 && (
        <div className="flex flex-col gap-2">
          {robots.map((r) => (
            <div
              key={r.pda}
              className={`bg-surface border rounded-lg p-3 flex flex-col gap-2 transition-colors ${
                selectedRobot?.pda === r.pda ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-foreground tracking-wider">{r.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-muted">{r.wins}W-{r.losses}L</span>
                  {selectedRobot?.pda === r.pda ? (
                    <span className="text-[8px] font-mono text-primary font-bold">✓ ACTIVE</span>
                  ) : (
                    <button
                      onClick={() => selectRobot(r.name)}
                      className="text-[8px] font-mono text-muted hover:text-primary border border-border hover:border-primary/60 rounded px-2 py-0.5 transition-colors"
                    >
                      USE THIS ONE
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <MiniStat label="ATK" value={r.attack} color="#ef4444" />
                <MiniStat label="DEF" value={r.defense} color="#3b82f6" />
                <MiniStat label="SPD" value={r.speed} color="#22c55e" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button
          onClick={() => setFormOpen(true)}
          className="text-[10px] font-mono text-primary hover:bg-primary/10 border border-primary/60 px-3 py-2.5 rounded-lg transition-colors self-start"
        >
          + REGISTER ANOTHER ROBOT
        </button>
      ) : (
      <>
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-muted uppercase font-mono">
          Robot Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="e.g. THUNDER-MK2"
          className="bg-surface border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
        />
        <div className="flex justify-between">
          <span className="text-[8px] text-muted font-mono">Max 32 characters</span>
          <span className="text-[8px] text-muted font-mono">{name.length}/32</span>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-[8px] tracking-[0.3em] text-muted uppercase">Combat Stats</p>
          <span
            className={`text-[9px] font-mono font-bold ${
              total > 240 ? "text-red-400" : total > 180 ? "text-yellow-400" : "text-muted"
            }`}
          >
            {total} / 300 pts
          </span>
        </div>
        <StatSlider
          label="Attack"
          value={attack}
          onChange={setAttack}
          accentColor="#ef4444"
          textClass="text-red-400"
        />
        <StatSlider
          label="Defense"
          value={defense}
          onChange={setDefense}
          accentColor="#3b82f6"
          textClass="text-blue-400"
        />
        <StatSlider
          label="Speed"
          value={speed}
          onChange={setSpeed}
          accentColor="#22c55e"
          textClass="text-green-400"
        />
      </div>

      {/* Categories */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3">
        <p className="text-[8px] tracking-[0.3em] text-muted uppercase">
          Competition Categories
        </p>
        <p className="text-[8px] text-muted">
          Select the categories this robot is designed for
        </p>
        <div className="flex flex-wrap gap-2">
          {ROBOT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-mono font-bold border transition-all ${
                categories.includes(cat)
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-transparent text-muted hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {categories.length > 0 && (
          <p className="text-[8px] text-primary font-mono">
            Selected: {categories.join(", ")}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleRegister}
        disabled={loading || !name.trim()}
        className="w-full py-4 rounded-xl font-black text-sm tracking-[0.3em] bg-primary hover:brightness-110 disabled:bg-surface disabled:text-muted disabled:cursor-not-allowed text-white transition-all shadow-lg"
      >
        {loading
          ? "◌ REGISTERING…"
          : !connected
          ? "CONNECT WALLET FIRST"
          : !name.trim()
          ? "ENTER ROBOT NAME"
          : "⬤ REGISTER ON-CHAIN"}
      </button>
      </>
      )}

      {tx && (
        <div className="border border-green-900/60 rounded-lg p-3 bg-green-950/20 flex flex-col gap-1">
          <p className="text-[9px] text-green-400 font-mono font-bold">✓ Robot registered on-chain</p>
          <p className="text-[8px] text-green-700 font-mono truncate">{tx}</p>
          <button
            onClick={() => {
              setTx(null);
              setName("");
              setCategories([]);
              setAttack(70);
              setDefense(60);
              setSpeed(65);
            }}
            className="mt-1 text-[8px] text-muted hover:text-foreground self-start"
          >
            Register another →
          </button>
        </div>
      )}
      {error && (
        <div className="border border-red-900/60 rounded-lg p-3 bg-red-950/20">
          <p className="text-[9px] text-red-400 font-mono">{error}</p>
        </div>
      )}
    </div>
  );
}
