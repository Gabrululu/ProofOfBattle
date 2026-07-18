import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useProgram } from "../hooks/useProgram";
import { ROBOT_CATEGORIES } from "../types";

const BRIDGE_HTTP = (import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000").replace(
  /^wss?/,
  (m: string) => (m === "wss" ? "https" : "http")
);

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
        <span className="text-[9px] font-mono tracking-widest text-gray-600 uppercase">{label}</span>
        <span className={`text-[11px] font-black tabular-nums ${textClass}`}>{value}</span>
      </div>
      <div className="relative h-2 flex items-center">
        <div className="absolute inset-0 bg-gray-900 rounded-full" />
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
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useProgram();

  const [name, setName] = useState("");
  const [attack, setAttack] = useState(70);
  const [defense, setDefense] = useState(60);
  const [speed, setSpeed] = useState(65);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!program || !publicKey || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const sig = await (program.methods as unknown as {
        registerRobot: (name: string, attack: number, defense: number, speed: number) => {
          accounts: (a: object) => { rpc: () => Promise<string> };
        };
      })
        .registerRobot(name.trim(), attack, defense, speed)
        .accounts({ owner: publicKey })
        .rpc();

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const total = attack + defense + speed;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto pb-24">
      <div>
        <h2 className="text-sm font-black tracking-[0.3em] text-gray-200 uppercase">
          Register Robot
        </h2>
        <p className="text-[9px] text-gray-600 tracking-wider mt-0.5">
          Inscribe your competition robot on-chain
        </p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-gray-500 uppercase font-mono">
          Robot Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="e.g. THUNDER-MK2"
          className="bg-[#0c0c1a] border border-gray-800 rounded-lg px-3 py-2.5 text-xs font-mono text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-purple-700 transition-colors"
        />
        <div className="flex justify-between">
          <span className="text-[8px] text-gray-700 font-mono">Max 32 characters</span>
          <span className="text-[8px] text-gray-700 font-mono">{name.length}/32</span>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-[#08080f] border border-gray-900 rounded-lg p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase">Combat Stats</p>
          <span
            className={`text-[9px] font-mono font-bold ${
              total > 240 ? "text-red-400" : total > 180 ? "text-yellow-400" : "text-gray-600"
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
      <div className="bg-[#08080f] border border-gray-900 rounded-lg p-4 flex flex-col gap-3">
        <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase">
          Competition Categories
        </p>
        <p className="text-[8px] text-gray-600">
          Select the categories this robot is designed for
        </p>
        <div className="flex flex-wrap gap-2">
          {ROBOT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-mono font-bold border transition-all ${
                categories.includes(cat)
                  ? "border-purple-600 bg-purple-950/60 text-purple-300"
                  : "border-gray-800 bg-transparent text-gray-600 hover:border-gray-600 hover:text-gray-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {categories.length > 0 && (
          <p className="text-[8px] text-purple-500 font-mono">
            Selected: {categories.join(", ")}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleRegister}
        disabled={loading || !name.trim()}
        className="w-full py-4 rounded-xl font-black text-sm tracking-[0.3em] bg-purple-700 hover:bg-purple-600 disabled:bg-gray-900 disabled:text-gray-700 disabled:cursor-not-allowed text-white transition-all shadow-lg"
      >
        {loading
          ? "◌ REGISTERING…"
          : !connected
          ? "CONNECT WALLET FIRST"
          : !name.trim()
          ? "ENTER ROBOT NAME"
          : "⬤ REGISTER ON-CHAIN"}
      </button>

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
            className="mt-1 text-[8px] text-gray-600 hover:text-gray-400 self-start"
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
