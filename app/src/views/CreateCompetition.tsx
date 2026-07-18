import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { TeamMember, RobotInfo } from "../types";

const BRIDGE_HTTP = (import.meta.env.VITE_BRIDGE_URL ?? "ws://localhost:8000").replace(
  /^wss?/,
  (m: string) => (m === "wss" ? "https" : "http")
);

interface Props {
  onCreated: (battleId: number) => void;
}

// ── Tiny robot stat display ───────────────────────────────────────────────────
function RobotStatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-mono text-gray-600 w-8">{label}</span>
      <div className="flex-1 h-1 bg-gray-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[9px] font-mono w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Robot picker card ─────────────────────────────────────────────────────────
function RobotCard({
  role,
  robot,
  loading,
  walletInput,
  onWalletChange,
  onSearch,
  onStatChange,
  onNameChange,
}: {
  role: "A" | "B";
  robot: RobotInfo | null;
  loading: boolean;
  walletInput: string;
  onWalletChange: (v: string) => void;
  onSearch: () => void;
  onStatChange: (field: keyof RobotInfo, val: number | string) => void;
  onNameChange: (v: string) => void;
}) {
  const isA = role === "A";
  const borderColor = isA ? "border-blue-900/60" : "border-red-900/60";
  const labelColor  = isA ? "text-blue-400" : "text-red-400";
  const accentColor = isA ? "#3b82f6" : "#ef4444";

  return (
    <div className={`bg-[#08080f] border ${borderColor} rounded-xl p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black text-white"
          style={{ backgroundColor: accentColor }}
        >
          {role}
        </span>
        <span className={`text-[9px] font-mono font-bold tracking-widest ${labelColor}`}>
          {isA ? "YOUR ROBOT" : "OPPONENT"}
        </span>
        {robot && (
          <span className="ml-auto text-[8px] text-green-500 font-mono">✓ found</span>
        )}
      </div>

      {/* Wallet search (only for Robot B or if A has no profile) */}
      {(!isA || !robot) && (
        <div className="flex gap-2">
          <input
            type="text"
            value={walletInput}
            onChange={(e) => onWalletChange(e.target.value)}
            placeholder={isA ? "Your wallet address (optional)" : "Opponent wallet address"}
            className="flex-1 bg-[#05050f] border border-gray-800 rounded-lg px-2.5 py-2 text-[9px] font-mono text-gray-300 placeholder:text-gray-700 focus:outline-none focus:border-purple-700"
          />
          <button
            onClick={onSearch}
            disabled={loading || !walletInput.trim()}
            className="px-3 py-2 rounded-lg text-[9px] font-mono font-bold border border-purple-800/60 text-purple-400 bg-purple-950/30 hover:bg-purple-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "◌" : "SEARCH"}
          </button>
        </div>
      )}

      {/* Robot name input */}
      <div className="flex flex-col gap-1">
        <label className="text-[8px] text-gray-600 font-mono tracking-widest">NAME</label>
        <input
          type="text"
          value={robot?.name ?? ""}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={32}
          placeholder={isA ? "UNIT-ALPHA" : "UNIT-BETA"}
          className="bg-[#05050f] border border-gray-800 rounded-lg px-2.5 py-2 text-[10px] font-mono text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-purple-700 transition-colors"
        />
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-1.5">
        {(["attack", "defense", "speed"] as const).map((stat) => {
          const colors = { attack: "#ef4444", defense: "#3b82f6", speed: "#22c55e" };
          const labels = { attack: "ATK", defense: "DEF", speed: "SPD" };
          return (
            <div key={stat} className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-gray-600 w-8">{labels[stat]}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={robot?.[stat] ?? 70}
                onChange={(e) => onStatChange(stat, Number(e.target.value))}
                className="flex-1 h-1 appearance-none bg-gray-900 rounded-full cursor-pointer"
                style={{ accentColor: colors[stat] }}
              />
              <span
                className="text-[9px] font-mono w-6 text-right tabular-nums"
                style={{ color: colors[stat] }}
              >
                {robot?.[stat] ?? 70}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CreateCompetition({ onCreated }: Props) {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [name, setName]         = useState("");
  const [location, setLocation] = useState("");
  const [isTeam, setIsTeam]     = useState(false);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers]   = useState<TeamMember[]>([
    { wallet: "", alias: "", share: 100 },
  ]);

  // Robot A (creator's robot)
  const [robotA, setRobotA]               = useState<RobotInfo | null>(null);
  const [robotAWallet, setRobotAWallet]   = useState("");
  const [loadingA, setLoadingA]           = useState(false);

  // Robot B (opponent)
  const [robotB, setRobotB]               = useState<RobotInfo>({ name: "UNIT_BETA", attack: 70, defense: 60, speed: 65 });
  const [robotBWallet, setRobotBWallet]   = useState("");
  const [loadingB, setLoadingB]           = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [created, setCreated]   = useState<{ id: number; name: string } | null>(null);

  // Auto-fetch creator's robot profile on wallet connect
  useEffect(() => {
    if (!publicKey) return;
    const pubkey = publicKey.toBase58();
    setLoadingA(true);
    fetch(`${BRIDGE_HTTP}/api/robot-profile/${pubkey}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.name) {
          setRobotA({
            name: data.name,
            attack: data.attack ?? 70,
            defense: data.defense ?? 60,
            speed: data.speed ?? 65,
            categories: data.categories ?? [],
          });
          setRobotAWallet(pubkey);
        } else {
          // No profile yet — start with defaults
          setRobotA({ name: "UNIT_ALPHA", attack: 70, defense: 60, speed: 65 });
        }
      })
      .catch(() => setRobotA({ name: "UNIT_ALPHA", attack: 70, defense: 60, speed: 65 }))
      .finally(() => setLoadingA(false));
  }, [publicKey]);

  const searchRobotByWallet = async (wallet: string, side: "a" | "b") => {
    if (!wallet.trim()) return;
    if (side === "a") setLoadingA(true);
    else setLoadingB(true);
    try {
      const r = await fetch(`${BRIDGE_HTTP}/api/robot-profile/${wallet.trim()}`);
      const data = await r.json();
      const profile: RobotInfo = data?.name
        ? { name: data.name, attack: data.attack ?? 70, defense: data.defense ?? 60, speed: data.speed ?? 65, categories: data.categories }
        : { name: side === "a" ? "UNIT_ALPHA" : "UNIT_BETA", attack: 70, defense: 60, speed: 65 };
      if (side === "a") setRobotA(profile);
      else setRobotB(profile);
    } catch {
      /* keep current */
    } finally {
      if (side === "a") setLoadingA(false);
      else setLoadingB(false);
    }
  };

  const updateRobotA = (field: keyof RobotInfo, val: number | string) => {
    setRobotA((prev) => ({ ...(prev ?? { name: "", attack: 70, defense: 60, speed: 65 }), [field]: val }));
  };

  const updateRobotB = (field: keyof RobotInfo, val: number | string) => {
    setRobotB((prev) => ({ ...prev, [field]: val }));
  };

  const totalShare = members.reduce((s, m) => s + m.share, 0);

  const addMember = () => {
    setMembers((prev) => [...prev, { wallet: "", alias: "", share: Math.max(0, 100 - totalShare) }]);
  };
  const removeMember = (i: number) => setMembers((prev) => prev.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: keyof TeamMember, val: string | number) =>
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));

  const handleCreate = async () => {
    if (!connected) { setVisible(true); return; }
    if (!name.trim() || !location.trim()) { setError("Nombre y ubicación son requeridos"); return; }
    if (!robotA?.name.trim()) { setError("Ingresa un nombre para Robot A"); return; }
    if (!robotB?.name.trim()) { setError("Ingresa un nombre para Robot B"); return; }
    if (isTeam && totalShare !== 100) { setError(`El reparto debe sumar 100% (actualmente ${totalShare}%)`); return; }

    const battleId = Date.now() % 10_000_000;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${BRIDGE_HTTP}/api/competition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battle_id: battleId,
          name: name.trim(),
          location: location.trim(),
          creator: publicKey?.toBase58() ?? "",
          is_team: isTeam,
          team_name: isTeam ? teamName.trim() || null : null,
          members: isTeam ? members.filter((m) => m.alias || m.wallet) : [],
          robot_a_name: robotA?.name ?? "UNIT_ALPHA",
          robot_a_attack: robotA?.attack ?? 70,
          robot_a_defense: robotA?.defense ?? 60,
          robot_a_speed: robotA?.speed ?? 65,
          robot_b_name: robotB.name,
          robot_b_attack: robotB.attack,
          robot_b_defense: robotB.defense,
          robot_b_speed: robotB.speed,
        }),
      });
      if (!resp.ok) throw new Error(`Error del servidor: ${resp.status}`);
      setCreated({ id: battleId, name: name.trim() });
      onCreated(battleId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear la competencia");
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="flex flex-col gap-5 p-6 max-w-lg mx-auto items-center text-center pb-24"
           style={{ animation: "fade-up 0.4s ease-out both" }}>
        <div className="text-5xl">⚔</div>
        <div>
          <h2 className="text-base font-black tracking-[0.2em] text-green-300">COMPETENCIA CREADA</h2>
          <p className="text-[10px] text-gray-500 mt-1 font-mono">{created.name}</p>
        </div>
        <div className="bg-[#08080f] border border-green-900/40 rounded-xl p-5 w-full text-left flex flex-col gap-2">
          <p className="text-[8px] text-gray-600 uppercase tracking-widest font-mono">Battle ID</p>
          <p className="text-2xl font-black text-green-300 font-mono">{created.id}</p>
          <p className="text-[8px] text-gray-600">
            Ve a la pestaña <span className="text-purple-400">LIVE</span> para iniciar la batalla cuando ambos competidores estén listos.
          </p>
        </div>
        <button
          onClick={() => { setCreated(null); setName(""); setLocation(""); setTeamName(""); setMembers([{ wallet: "", alias: "", share: 100 }]); }}
          className="px-5 py-2.5 rounded-lg border border-gray-800 text-gray-400 text-[10px] font-mono hover:border-gray-600 hover:text-gray-200 transition-colors tracking-widest"
        >
          ← CREAR OTRA
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto pb-24">
      <div>
        <h2 className="text-sm font-black tracking-[0.3em] text-gray-200 uppercase">Nueva Competencia</h2>
        <p className="text-[9px] text-gray-600 tracking-wider mt-0.5">Registra tu evento y elige los robots</p>
      </div>

      {/* Competition info */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-gray-500 uppercase font-mono">Nombre</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="ej. Lima Robotics Open 2025"
          className="bg-[#0c0c1a] border border-gray-800 rounded-lg px-3 py-2.5 text-xs font-mono text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-purple-700 transition-colors" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-gray-500 uppercase font-mono">Lugar / Venue</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="ej. UNI, Lima, Peru"
          className="bg-[#0c0c1a] border border-gray-800 rounded-lg px-3 py-2.5 text-xs font-mono text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-purple-700 transition-colors" />
      </div>

      {/* Robot pickers */}
      <p className="text-[8px] tracking-[0.3em] text-gray-700 uppercase font-mono mt-1">Robots combatientes</p>
      <RobotCard
        role="A"
        robot={robotA}
        loading={loadingA}
        walletInput={robotAWallet}
        onWalletChange={setRobotAWallet}
        onSearch={() => searchRobotByWallet(robotAWallet, "a")}
        onStatChange={updateRobotA}
        onNameChange={(v) => setRobotA((p) => ({ ...(p ?? { name: "", attack: 70, defense: 60, speed: 65 }), name: v }))}
      />
      <RobotCard
        role="B"
        robot={robotB}
        loading={loadingB}
        walletInput={robotBWallet}
        onWalletChange={setRobotBWallet}
        onSearch={() => searchRobotByWallet(robotBWallet, "b")}
        onStatChange={updateRobotB}
        onNameChange={(v) => setRobotB((p) => ({ ...p, name: v }))}
      />

      {/* Team toggle */}
      <div className="bg-[#08080f] border border-gray-900 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-[10px] font-bold text-gray-300 tracking-wider">Competencia de equipo</p>
            <p className="text-[8px] text-gray-600 mt-0.5">Invita compañeros y distribuye ganancias</p>
          </div>
          <button
            onClick={() => setIsTeam((t) => !t)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${isTeam ? "bg-purple-700" : "bg-gray-800"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${isTeam ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {isTeam && (
          <div className="flex flex-col gap-3 px-4 pb-4 border-t border-gray-900">
            <div className="flex flex-col gap-1 pt-3">
              <label className="text-[9px] tracking-widest text-gray-600 uppercase font-mono">Nombre del equipo</label>
              <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                placeholder="ej. Team Alpha"
                className="bg-[#05050f] border border-gray-800 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-purple-700" />
            </div>
            <p className="text-[8px] text-gray-600 uppercase tracking-widest font-mono mt-1">Miembros y reparto</p>
            {members.map((m, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 border border-gray-800/60 rounded-lg bg-[#05050f]">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-purple-500 font-mono font-bold">MIEMBRO {i + 1}</span>
                  {members.length > 1 && (
                    <button onClick={() => removeMember(i)} className="text-[8px] text-red-700 hover:text-red-500 font-mono">QUITAR</button>
                  )}
                </div>
                <input type="text" value={m.wallet} onChange={(e) => updateMember(i, "wallet", e.target.value)}
                  placeholder="Wallet (opcional)"
                  className="bg-[#08080f] border border-gray-800 rounded px-2.5 py-1.5 text-[9px] font-mono text-gray-300 placeholder:text-gray-700 focus:outline-none focus:border-purple-800" />
                <div className="flex gap-2">
                  <input type="text" value={m.alias} onChange={(e) => updateMember(i, "alias", e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 bg-[#08080f] border border-gray-800 rounded px-2.5 py-1.5 text-[9px] font-mono text-gray-300 placeholder:text-gray-700 focus:outline-none focus:border-purple-800" />
                  <div className="flex items-center gap-1">
                    <input type="number" value={m.share} min={0} max={100}
                      onChange={(e) => updateMember(i, "share", Number(e.target.value))}
                      className="w-14 bg-[#08080f] border border-gray-800 rounded px-2 py-1.5 text-[9px] font-mono text-yellow-400 text-center focus:outline-none focus:border-purple-800" />
                    <span className="text-[9px] text-gray-600 font-mono">%</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <button onClick={addMember} className="text-[9px] font-mono text-purple-500 hover:text-purple-300 border border-purple-900/60 px-3 py-1.5 rounded-lg transition-colors">
                + AGREGAR MIEMBRO
              </button>
              <span className={`text-[9px] font-mono font-bold ${totalShare === 100 ? "text-green-400" : totalShare > 100 ? "text-red-400" : "text-yellow-400"}`}>
                Total: {totalShare}%{totalShare === 100 ? " ✓" : ""}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[9px] text-red-400 font-mono bg-red-950/20 border border-red-900/40 rounded-lg px-3 py-2.5">{error}</p>
      )}

      <button
        onClick={handleCreate}
        disabled={loading || !name.trim() || !location.trim()}
        className="w-full py-4 rounded-xl font-black text-sm tracking-[0.3em] bg-purple-700 hover:bg-purple-600 disabled:bg-gray-900 disabled:text-gray-700 disabled:cursor-not-allowed text-white transition-all shadow-lg"
      >
        {loading ? "◌ CREANDO…" : !connected ? "CONECTA TU WALLET" : "⬤ CREAR COMPETENCIA"}
      </button>
    </div>
  );
}
