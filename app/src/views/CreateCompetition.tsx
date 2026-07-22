import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { TeamMember } from "../types";
import { BRIDGE_HTTP_URL as BRIDGE_HTTP } from "../lib/bridge";
import { confirmWithTimeout, fetchRobotsByOwner, RobotState } from "../lib/program";
import { useProgram } from "../hooks/useProgram";
import { useRobots } from "../hooks/useRobot";

interface Props {
  onCreated: (battleId: number) => void;
}

// ── Tiny robot stat display ───────────────────────────────────────────────────
function RobotStatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-mono text-muted w-8">{label}</span>
      <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-mono w-6 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Robot picker card — restricted to REAL on-chain robots ────────────────────
function RobotPickerCard({
  role,
  robots,
  selected,
  onSelect,
  walletInput,
  onWalletChange,
  onSearch,
  searching,
  searchable,
}: {
  role: "A" | "B";
  robots: RobotState[];
  selected: RobotState | null;
  onSelect: (r: RobotState) => void;
  walletInput?: string;
  onWalletChange?: (v: string) => void;
  onSearch?: () => void;
  searching?: boolean;
  searchable: boolean;
}) {
  const isA = role === "A";
  const borderColor = isA ? "border-blue-900/60" : "border-red-900/60";
  const labelColor  = isA ? "text-blue-400" : "text-red-400";
  const accentColor = isA ? "#3b82f6" : "#ef4444";

  return (
    <div className={`bg-surface border ${borderColor} rounded-xl p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black text-white"
          style={{ backgroundColor: accentColor }}
        >
          {role}
        </span>
        <span className={`text-[9px] font-mono font-bold tracking-widest ${labelColor}`}>
          {isA ? "TU ROBOT" : "OPONENTE"}
        </span>
      </div>

      {searchable && (
        <div className="flex gap-2">
          <input
            type="text"
            value={walletInput}
            onChange={(e) => onWalletChange?.(e.target.value)}
            placeholder="Wallet del oponente"
            className="flex-1 bg-background border border-border rounded-lg px-2.5 py-2 text-[9px] font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
          />
          <button
            onClick={onSearch}
            disabled={searching || !walletInput?.trim()}
            className="px-3 py-2 rounded-lg text-[9px] font-mono font-bold border border-primary/60 text-primary bg-primary/30 hover:bg-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? "◌" : "BUSCAR"}
          </button>
        </div>
      )}

      {robots.length === 0 ? (
        <p className="text-[9px] font-mono text-muted py-2">
          {isA ? "No tenés robots registrados todavía." : "Buscá una wallet para ver sus robots."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {robots.map((r) => (
            <button
              key={r.pda}
              onClick={() => onSelect(r)}
              className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                selected?.pda === r.pda ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-foreground">{r.name}</span>
                {selected?.pda === r.pda && <span className="text-[8px] text-primary font-mono">✓</span>}
              </div>
              <div className="flex flex-col gap-1">
                <RobotStatRow label="ATK" value={r.attack} color={accentColor} />
                <RobotStatRow label="DEF" value={r.defense} color="var(--color-secondary)" />
                <RobotStatRow label="SPD" value={r.speed} color="#FBBF24" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CreateCompetition({ onCreated }: Props) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const program = useProgram();
  const { robots: myRobots } = useRobots(publicKey);

  const [name, setName]         = useState("");
  const [location, setLocation] = useState("");
  const [isTeam, setIsTeam]     = useState(false);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers]   = useState<TeamMember[]>([
    { wallet: "", alias: "", share: 100 },
  ]);

  // Online (Webots + AI agent) vs Physical (real robots, human referee, live stream)
  const [mode, setMode] = useState<"online" | "physical">("online");
  const [streamUrl, setStreamUrl] = useState("");

  // Robot A — one of the creator's own registered robots
  const [robotA, setRobotA] = useState<RobotState | null>(null);

  // Robot B — search any wallet's registered robots (can be the creator's own again)
  const [robotBWallet, setRobotBWallet] = useState("");
  const [robotBCandidates, setRobotBCandidates] = useState<RobotState[]>([]);
  const [robotB, setRobotB] = useState<RobotState | null>(null);
  const [searchingB, setSearchingB] = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [created, setCreated]   = useState<{ id: number; name: string } | null>(null);

  const searchRobotB = async () => {
    const wallet = robotBWallet.trim();
    if (!wallet) return;
    setSearchingB(true);
    setRobotB(null);
    try {
      const owner = new PublicKey(wallet);
      const found = await fetchRobotsByOwner(connection, owner);
      setRobotBCandidates(found);
      if (found.length === 0) setError("Esa wallet no tiene robots registrados.");
      else setError(null);
    } catch {
      setError("Dirección de wallet inválida.");
      setRobotBCandidates([]);
    } finally {
      setSearchingB(false);
    }
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
    if (!program || !publicKey || !signTransaction) return;
    if (!name.trim() || !location.trim()) { setError("Nombre y ubicación son requeridos"); return; }
    if (!robotA) { setError("Elegí uno de tus robots para el lado A"); return; }
    if (!robotB) { setError("Buscá y elegí un robot oponente para el lado B"); return; }
    if (isTeam && totalShare !== 100) { setError(`El reparto debe sumar 100% (actualmente ${totalShare}%)`); return; }
    if (mode === "physical" && !streamUrl.trim()) { setError("Pegá el link de la transmisión en vivo"); return; }

    const battleId = Date.now() % 10_000_000;
    setLoading(true);
    setError(null);
    try {
      // 1. Create the battle on-chain, signed by the creator's own wallet —
      // required so the program's `robot_a.owner == creator.key()` constraint
      // holds for robotA (their real, already-registered robot).
      const ix = await program.methods
        .createBattle(new BN(battleId), new BN(0))
        .accounts({
          robotA: new PublicKey(robotA.pda),
          robotB: new PublicKey(robotB.pda),
          creator: publicKey,
        })
        .instruction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey }).add(ix);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await confirmWithTimeout(connection, sig, blockhash, lastValidBlockHeight);

      // 2. Only after the on-chain battle is confirmed, record the off-chain
      // metadata (display name/stats, mode, stream url) with the bridge.
      const resp = await fetch(`${BRIDGE_HTTP}/api/competition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battle_id: battleId,
          name: name.trim(),
          location: location.trim(),
          creator: publicKey.toBase58(),
          is_team: isTeam,
          team_name: isTeam ? teamName.trim() || null : null,
          members: isTeam ? members.filter((m) => m.alias || m.wallet) : [],
          mode,
          stream_url: mode === "physical" ? streamUrl.trim() : "",
          on_chain_tx: sig,
          robot_a_name: robotA.name,
          robot_a_attack: robotA.attack,
          robot_a_defense: robotA.defense,
          robot_a_speed: robotA.speed,
          robot_b_name: robotB.name,
          robot_b_attack: robotB.attack,
          robot_b_defense: robotB.defense,
          robot_b_speed: robotB.speed,
        }),
      });
      if (!resp.ok) throw new Error(`La batalla se creó on-chain (${sig.slice(0, 12)}…) pero el bridge respondió ${resp.status} — reintentá guardar los datos.`);
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
      <div className="flex flex-col gap-5 p-6 md:p-8 max-w-lg mx-auto items-center text-center pb-24 md:pb-8"
           style={{ animation: "fade-up 0.4s ease-out both" }}>
        <div className="text-5xl">⚔</div>
        <div>
          <h2 className="text-base font-black tracking-[0.2em] text-green-300">COMPETENCIA CREADA</h2>
          <p className="text-[10px] text-muted mt-1 font-mono">{created.name}</p>
        </div>
        <div className="bg-surface border border-green-900/40 rounded-xl p-5 w-full text-left flex flex-col gap-2">
          <p className="text-[8px] text-muted uppercase tracking-widest font-mono">Battle ID</p>
          <p className="text-2xl font-black text-green-300 font-mono">{created.id}</p>
          <p className="text-[8px] text-muted">
            Ve a la pestaña <span className="text-primary">LIVE</span> para iniciar la batalla cuando ambos competidores estén listos.
          </p>
        </div>
        <button
          onClick={() => { setCreated(null); setName(""); setLocation(""); setTeamName(""); setMembers([{ wallet: "", alias: "", share: 100 }]); setRobotB(null); setRobotBCandidates([]); setRobotBWallet(""); }}
          className="px-5 py-2.5 rounded-lg border border-border text-muted text-[10px] font-mono hover:border-primary/40 hover:text-foreground transition-colors tracking-widest"
        >
          ← CREAR OTRA
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-8 max-w-2xl mx-auto pb-24 md:pb-8">
      <div>
        <h2 className="text-sm font-black tracking-[0.3em] text-foreground uppercase">Nueva Competencia</h2>
        <p className="text-[9px] text-muted tracking-wider mt-0.5">Registra tu evento y elige los robots</p>
      </div>

      {/* Competition info */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-muted uppercase font-mono">Nombre</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="ej. Lima Robotics Open 2025"
          className="bg-surface border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-muted uppercase font-mono">Lugar / Venue</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="ej. UNI, Lima, Peru"
          className="bg-surface border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors" />
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] tracking-widest text-muted uppercase font-mono">Modalidad</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("online")}
            className={`py-2.5 rounded-lg text-[10px] font-mono font-bold tracking-widest border transition-colors ${
              mode === "online" ? "border-primary bg-primary/20 text-primary" : "border-border text-muted"
            }`}
          >
            ⚡ ONLINE (SIMULADA)
          </button>
          <button
            onClick={() => setMode("physical")}
            className={`py-2.5 rounded-lg text-[10px] font-mono font-bold tracking-widest border transition-colors ${
              mode === "physical" ? "border-primary bg-primary/20 text-primary" : "border-border text-muted"
            }`}
          >
            🤖 FÍSICA (EN VIVO)
          </button>
        </div>
        {mode === "physical" && (
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-[8px] text-muted font-mono">
              Link de transmisión en vivo (YouTube Live, Twitch, etc.)
            </label>
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="bg-surface border border-border rounded-lg px-3 py-2 text-[10px] font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-[8px] text-muted">
              Vos vas a hacer de árbitro: reportás golpes y declarás el ganador desde el panel de la batalla.
            </p>
          </div>
        )}
      </div>

      {/* Robot pickers */}
      <p className="text-[8px] tracking-[0.3em] text-muted uppercase font-mono mt-1">Robots combatientes</p>
      <RobotPickerCard
        role="A"
        robots={myRobots}
        selected={robotA}
        onSelect={setRobotA}
        searchable={false}
      />
      <RobotPickerCard
        role="B"
        robots={robotBCandidates}
        selected={robotB}
        onSelect={setRobotB}
        walletInput={robotBWallet}
        onWalletChange={setRobotBWallet}
        onSearch={searchRobotB}
        searching={searchingB}
        searchable
      />

      {/* Team toggle */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-[10px] font-bold text-foreground tracking-wider">Competencia de equipo</p>
            <p className="text-[8px] text-muted mt-0.5">Invita compañeros y distribuye ganancias</p>
          </div>
          <button
            onClick={() => setIsTeam((t) => !t)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${isTeam ? "bg-primary" : "bg-surface"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${isTeam ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {isTeam && (
          <div className="flex flex-col gap-3 px-4 pb-4 border-t border-border">
            <div className="flex flex-col gap-1 pt-3">
              <label className="text-[9px] tracking-widest text-muted uppercase font-mono">Nombre del equipo</label>
              <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                placeholder="ej. Team Alpha"
                className="bg-background border border-border rounded-lg px-3 py-2 text-[10px] font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary" />
            </div>
            <p className="text-[8px] text-muted uppercase tracking-widest font-mono mt-1">Miembros y reparto</p>
            {members.map((m, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 border border-border/60 rounded-lg bg-background">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-primary font-mono font-bold">MIEMBRO {i + 1}</span>
                  {members.length > 1 && (
                    <button onClick={() => removeMember(i)} className="text-[8px] text-red-700 hover:text-red-500 font-mono">QUITAR</button>
                  )}
                </div>
                <input type="text" value={m.wallet} onChange={(e) => updateMember(i, "wallet", e.target.value)}
                  placeholder="Wallet (opcional)"
                  className="bg-surface border border-border rounded px-2.5 py-1.5 text-[9px] font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary" />
                <div className="flex gap-2">
                  <input type="text" value={m.alias} onChange={(e) => updateMember(i, "alias", e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 bg-surface border border-border rounded px-2.5 py-1.5 text-[9px] font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-primary" />
                  <div className="flex items-center gap-1">
                    <input type="number" value={m.share} min={0} max={100}
                      onChange={(e) => updateMember(i, "share", Number(e.target.value))}
                      className="w-14 bg-surface border border-border rounded px-2 py-1.5 text-[9px] font-mono text-yellow-400 text-center focus:outline-none focus:border-primary" />
                    <span className="text-[9px] text-muted font-mono">%</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <button onClick={addMember} className="text-[9px] font-mono text-primary hover:bg-primary/10 border border-primary/60 px-3 py-1.5 rounded-lg transition-colors">
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
        className="w-full py-4 rounded-xl font-black text-sm tracking-[0.3em] bg-primary hover:brightness-110 disabled:bg-surface disabled:text-muted disabled:cursor-not-allowed text-white transition-all shadow-lg"
      >
        {loading ? "◌ CREANDO…" : !connected ? "CONECTA TU WALLET" : "⬤ CREAR COMPETENCIA"}
      </button>
    </div>
  );
}
