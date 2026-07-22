import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, Href } from "expo-router";
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { BRIDGE_BASE_URL, PROGRAM_ID } from "../lib/constants";
import {
  connection, getBattlePDA, getVaultPDA, serializeCreateBattle,
  confirmWithTimeout, fetchRobotsByOwner, RobotState,
} from "../lib/program";
import { useWallet } from "../hooks/useWallet";
import { useRobots } from "../hooks/useRobot";
import { WalletButton } from "../components/WalletButton";
import { toast } from "../components/Toast";
import { C, MONO, SANS_700, SANS_900 } from "../lib/theme";

interface Member {
  wallet: string;
  alias: string;
  share: string;
}

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sty.sectionRow}>
      <Text style={sty.sectionLabel}>{label}</Text>
      <View style={sty.sectionLine} />
    </View>
  );
}

// ── Text field ─────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string;
}) {
  return (
    <View style={sty.field}>
      <Text style={sty.fieldLabel}>{label}</Text>
      {hint ? <Text style={sty.fieldHint}>{hint}</Text> : null}
      <TextInput
        style={sty.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
      />
    </View>
  );
}

// ── Mini stat row ──────────────────────────────────────────────────────────────

function MiniStats({ attack, defense, speed }: { attack: number; defense: number; speed: number }) {
  return (
    <View style={sty.miniStats}>
      <Text style={[sty.miniStat, { color: C.danger }]}>ATK {attack}</Text>
      <Text style={sty.miniDot}>·</Text>
      <Text style={[sty.miniStat, { color: C.teal }]}>DEF {defense}</Text>
      <Text style={sty.miniDot}>·</Text>
      <Text style={[sty.miniStat, { color: C.waiting }]}>SPD {speed}</Text>
    </View>
  );
}

// ── Robot picker — restricted to REAL on-chain robots ─────────────────────────

function RobotPicker({
  title, accentColor, candidates, selected, onSelect,
  walletSearch, onWalletSearch, onSearch, searching, emptyHint,
}: {
  title: string;
  accentColor: string;
  candidates: RobotState[];
  selected: RobotState | null;
  onSelect: (r: RobotState) => void;
  walletSearch?: string;
  onWalletSearch?: (v: string) => void;
  onSearch?: () => void;
  searching?: boolean;
  emptyHint: string;
}) {
  return (
    <View style={[sty.robotCard, { borderColor: accentColor + "55" }]}>
      <Text style={[sty.robotCardTitle, { color: accentColor }]}>{title}</Text>

      {onWalletSearch !== undefined && onSearch !== undefined && (
        <View style={sty.searchRow}>
          <TextInput
            style={[sty.input, { flex: 1 }]}
            value={walletSearch}
            onChangeText={onWalletSearch}
            placeholder="Opponent wallet address"
            placeholderTextColor={C.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[sty.searchBtn, searching && { opacity: 0.5 }]}
            onPress={onSearch}
            disabled={searching}
            activeOpacity={0.8}
          >
            {searching
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={sty.searchBtnText}>FIND</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {candidates.length === 0 ? (
        <Text style={sty.emptyHint}>{emptyHint}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {candidates.map((r) => (
            <TouchableOpacity
              key={r.pda}
              onPress={() => onSelect(r)}
              activeOpacity={0.8}
              style={[
                sty.robotOption,
                selected?.pda === r.pda && { borderColor: accentColor, backgroundColor: accentColor + "15" },
              ]}
            >
              <View style={sty.robotOptionHeader}>
                <Text style={sty.robotOptionName}>{r.name}</Text>
                {selected?.pda === r.pda && <Text style={{ color: accentColor, fontSize: 11 }}>✓</Text>}
              </View>
              <MiniStats attack={r.attack} defense={r.defense} speed={r.speed} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Member row ─────────────────────────────────────────────────────────────────

function MemberRow({
  member, index, onChange, onRemove, canRemove,
}: {
  member: Member; index: number;
  onChange: (field: keyof Member, val: string) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  return (
    <View style={sty.memberCard}>
      <View style={sty.memberHeader}>
        <Text style={sty.memberNum}>MEMBER {index + 1}</Text>
        {canRemove && (
          <TouchableOpacity onPress={onRemove}>
            <Text style={sty.removeBtn}>REMOVE</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        style={sty.input}
        value={member.wallet}
        onChangeText={(v) => onChange("wallet", v)}
        placeholder="Wallet address (optional)"
        placeholderTextColor={C.textDim}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={sty.memberRow}>
        <TextInput
          style={[sty.input, { flex: 1 }]}
          value={member.alias}
          onChangeText={(v) => onChange("alias", v)}
          placeholder="Display name"
          placeholderTextColor={C.textDim}
        />
        <View style={sty.shareBox}>
          <TextInput
            style={[sty.input, sty.shareInput]}
            value={member.share}
            onChangeText={(v) => onChange("share", v)}
            placeholder="0"
            placeholderTextColor={C.textDim}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={sty.sharePct}>%</Text>
        </View>
      </View>
    </View>
  );
}

// ── Success card ──────────────────────────────────────────────────────────────

function SuccessCard({ battleId, name, onBack }: { battleId: number; name: string; onBack: () => void }) {
  return (
    <View style={sty.successCard}>
      <Text style={sty.successIcon}>⚔</Text>
      <Text style={sty.successTitle}>COMPETITION REGISTERED</Text>
      <Text style={sty.successName}>{name}</Text>
      <View style={sty.successIdBox}>
        <Text style={sty.successIdLabel}>BATTLE ID</Text>
        <Text style={sty.successId}>{battleId}</Text>
        <Text style={sty.successIdHint}>
          Go to Live Arenas and tap "INICIAR BATALLA" when ready to fight.
        </Text>
      </View>
      <TouchableOpacity style={sty.backBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={sty.backBtnText}>← BACK TO ARENAS</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CompeteScreen() {
  const router = useRouter();
  const { publicKey, connect, disconnect, connecting, isWebPreview, authorizeSession } = useWallet();
  const { robots: myRobots } = useRobots(publicKey);

  const [name, setName]         = useState("");
  const [location, setLocation] = useState("");
  const [isTeam, setIsTeam]     = useState(false);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers]   = useState<Member[]>([
    { wallet: "", alias: "", share: "100" },
  ]);
  const [loading, setLoading]   = useState(false);
  const [created, setCreated]   = useState<{ id: number; name: string } | null>(null);

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

  const searchRobotB = async () => {
    const w = robotBWallet.trim();
    if (!w) return;
    setSearchingB(true);
    setRobotB(null);
    try {
      const owner = new PublicKey(w);
      const found = await fetchRobotsByOwner(owner);
      setRobotBCandidates(found);
      if (found.length === 0) toast.error("Not found", "That wallet has no registered robots.");
    } catch {
      toast.error("Invalid wallet", "Check the address and try again.");
      setRobotBCandidates([]);
    } finally {
      setSearchingB(false);
    }
  };

  const totalShare = members.reduce((s, m) => s + (parseInt(m.share) || 0), 0);

  const addMember = () => {
    const remaining = Math.max(0, 100 - totalShare);
    setMembers((prev) => [...prev, { wallet: "", alias: "", share: String(remaining) }]);
  };

  const removeMember = (i: number) => {
    setMembers((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateMember = (i: number, field: keyof Member, val: string) => {
    setMembers((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [field]: val } : m))
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Required", "Enter a competition name."); return; }
    if (!location.trim()) { toast.error("Required", "Enter a location / venue."); return; }
    if (!publicKey) { toast.error("Wallet required", "Connect your wallet first."); return; }
    if (!robotA) { toast.error("Robot required", "Pick one of your registered robots for side A."); return; }
    if (!robotB) { toast.error("Opponent required", "Search and pick an opponent robot for side B."); return; }
    if (isTeam && totalShare !== 100) {
      toast.error("Share mismatch", `Profit shares must add up to 100% (currently ${totalShare}%).`);
      return;
    }
    if (mode === "physical" && !streamUrl.trim()) {
      toast.error("Stream required", "Paste the live stream link (YouTube Live, Twitch, etc).");
      return;
    }

    const battleId = Date.now() % 10_000_000;
    setLoading(true);

    try {
      const [battlePDA] = getBattlePDA(battleId);
      const [vaultPDA] = getVaultPDA(battleId);
      const data = serializeCreateBattle(battleId, 0);
      const robotAPda = new PublicKey(robotA.pda);
      const robotBPda = new PublicKey(robotB.pda);

      await transact(async (wallet: Parameters<Parameters<typeof transact>[0]>[0]) => {
        await authorizeSession(wallet);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });
        tx.add(new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: battlePDA,                isSigner: false, isWritable: true  },
            { pubkey: vaultPDA,                 isSigner: false, isWritable: true  },
            { pubkey: robotAPda,                isSigner: false, isWritable: false },
            { pubkey: robotBPda,                isSigner: false, isWritable: false },
            { pubkey: publicKey,                isSigner: true,  isWritable: true  },
            { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
          ],
          data,
        }));
        const [signed] = await wallet.signTransactions({ transactions: [tx] });
        const sig = await connection.sendRawTransaction(signed.serialize());
        await confirmWithTimeout(sig, blockhash, lastValidBlockHeight);

        const resp = await fetch(`${BRIDGE_BASE_URL}/api/competition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            battle_id: battleId,
            name: name.trim(),
            location: location.trim(),
            creator: publicKey.toBase58(),
            is_team: isTeam,
            team_name: isTeam && teamName.trim() ? teamName.trim() : null,
            members: isTeam
              ? members
                  .filter((m) => m.alias || m.wallet)
                  .map((m) => ({ wallet: m.wallet, alias: m.alias, share: parseInt(m.share) || 0 }))
              : [],
            mode,
            stream_url: mode === "physical" ? streamUrl.trim() : "",
            on_chain_tx: sig,
            robot_a_name:    robotA.name,
            robot_a_attack:  robotA.attack,
            robot_a_defense: robotA.defense,
            robot_a_speed:   robotA.speed,
            robot_b_name:    robotB.name,
            robot_b_attack:  robotB.attack,
            robot_b_defense: robotB.defense,
            robot_b_speed:   robotB.speed,
          }),
        });
        if (!resp.ok) throw new Error(`Battle created on-chain (${sig.slice(0, 12)}…) but bridge responded ${resp.status}`);
        setCreated({ id: battleId, name: name.trim() });
      });
    } catch (e: unknown) {
      toast.error("Failed to create", e instanceof Error ? e.message : "Check bridge connection.");
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <SafeAreaView style={sty.safe}>
        <Stack.Screen options={{ title: "COMPETITION CREATED" }} />
        <ScrollView contentContainerStyle={sty.content}>
          <SuccessCard
            battleId={created.id}
            name={created.name}
            onBack={() => router.replace("/home" as Href)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sty.safe}>
      <Stack.Screen options={{ title: "CREATE COMPETITION" }} />
      <ScrollView contentContainerStyle={sty.content} keyboardShouldPersistTaps="handled">

        {/* Wallet */}
        <View style={sty.walletRow}>
          <WalletButton
            publicKey={publicKey}
            connecting={connecting}
            isWebPreview={isWebPreview}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </View>

        <SectionLabel label="COMPETITION DETAILS" />

        <Field
          label="COMPETITION NAME"
          value={name}
          onChange={setName}
          placeholder="e.g. Lima Robotics Open 2025"
        />

        <Field
          label="LOCATION / VENUE"
          value={location}
          onChange={setLocation}
          placeholder="e.g. UNI, Lima, Peru"
        />

        <SectionLabel label="MODE" />

        <View style={sty.modeRow}>
          <TouchableOpacity
            style={[sty.modeBtn, mode === "online" && sty.modeBtnActive]}
            onPress={() => setMode("online")}
            activeOpacity={0.8}
          >
            <Text style={[sty.modeBtnText, mode === "online" && sty.modeBtnTextActive]}>⚡ ONLINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[sty.modeBtn, mode === "physical" && sty.modeBtnActive]}
            onPress={() => setMode("physical")}
            activeOpacity={0.8}
          >
            <Text style={[sty.modeBtnText, mode === "physical" && sty.modeBtnTextActive]}>🤖 PHYSICAL</Text>
          </TouchableOpacity>
        </View>

        {mode === "physical" && (
          <Field
            label="LIVE STREAM LINK"
            value={streamUrl}
            onChange={setStreamUrl}
            placeholder="https://youtube.com/watch?v=..."
            hint="You'll referee the fight — report hits and declare the winner from the battle screen."
          />
        )}

        <SectionLabel label="COMBATANTS" />

        <RobotPicker
          title="ROBOT A · YOUR FIGHTER"
          accentColor={C.purple}
          candidates={myRobots}
          selected={robotA}
          onSelect={setRobotA}
          emptyHint={myRobots.length === 0 ? "You have no registered robots yet — register one first." : ""}
        />

        <RobotPicker
          title="ROBOT B · OPPONENT"
          accentColor={C.teal}
          candidates={robotBCandidates}
          selected={robotB}
          onSelect={setRobotB}
          walletSearch={robotBWallet}
          onWalletSearch={setRobotBWallet}
          onSearch={searchRobotB}
          searching={searchingB}
          emptyHint="Search a wallet address to see its robots."
        />

        <SectionLabel label="FORMAT" />

        {/* Team toggle */}
        <View style={sty.toggleCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={sty.toggleTitle}>Team Competition</Text>
            <Text style={sty.toggleSub}>
              Enable to invite teammates and distribute profits
            </Text>
          </View>
          <Switch
            value={isTeam}
            onValueChange={setIsTeam}
            trackColor={{ false: C.border, true: C.purple + "80" }}
            thumbColor={isTeam ? C.purple : C.textDim}
          />
        </View>

        {isTeam && (
          <>
            <Field
              label="TEAM NAME"
              value={teamName}
              onChange={setTeamName}
              placeholder="e.g. Team Alpha"
            />

            <SectionLabel label="TEAM MEMBERS · PROFIT SPLIT" />

            {members.map((m, i) => (
              <MemberRow
                key={i}
                member={m}
                index={i}
                onChange={(field, val) => updateMember(i, field, val)}
                onRemove={() => removeMember(i)}
                canRemove={members.length > 1}
              />
            ))}

            <View style={sty.addRow}>
              <TouchableOpacity style={sty.addBtn} onPress={addMember} activeOpacity={0.8}>
                <Text style={sty.addBtnText}>+ ADD MEMBER</Text>
              </TouchableOpacity>
              <Text style={[
                sty.shareTotalTxt,
                { color: totalShare === 100 ? C.green : totalShare > 100 ? C.danger : C.waiting },
              ]}>
                Total: {totalShare}%{totalShare === 100 ? " ✓" : ""}
              </Text>
            </View>
          </>
        )}

        <SectionLabel label="LAUNCH" />

        <TouchableOpacity
          style={[sty.createBtn, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sty.createBtnText}>
              {publicKey ? "⬤ CREATE COMPETITION" : "CONNECT WALLET FIRST"}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const sty = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, gap: 16, paddingBottom: 48 },

  walletRow: { alignItems: "center" },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionLabel: {
    fontFamily: MONO, color: C.textDim,
    fontSize: 9, fontWeight: "800", letterSpacing: 4,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  field:      { gap: 6 },
  fieldLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 3 },
  fieldHint:  { color: C.textDim, fontSize: 11, marginTop: -2 },
  input: {
    backgroundColor: C.bgCard, borderRadius: 8, borderWidth: 1,
    borderColor: C.border, padding: 14, color: C.textPrimary,
    fontFamily: MONO, fontSize: 13, letterSpacing: 1,
  },

  // Mode toggle
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingVertical: 12, alignItems: "center", backgroundColor: C.bgCard,
  },
  modeBtnActive: { borderColor: C.purple, backgroundColor: C.purple + "22" },
  modeBtnText: { fontFamily: MONO, color: C.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  modeBtnTextActive: { color: C.purple },

  // Robot picker
  robotCard: {
    backgroundColor: C.bgCard, borderRadius: 12,
    borderWidth: 1, padding: 14, gap: 10,
  },
  robotCardTitle:  { fontFamily: MONO, fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  emptyHint: { fontFamily: MONO, color: C.textDim, fontSize: 10, paddingVertical: 6 },
  robotOption: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 10, gap: 6, backgroundColor: C.bg,
  },
  robotOptionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  robotOptionName: { fontFamily: MONO, color: C.textPrimary, fontSize: 11, fontWeight: "800" },
  miniStats: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniStat:  { fontFamily: MONO, fontSize: 10, fontWeight: "700" },
  miniDot:   { color: C.border, fontSize: 12 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBtn: {
    backgroundColor: C.teal + "30", borderWidth: 1, borderColor: C.teal + "60",
    borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14,
    alignItems: "center", justifyContent: "center",
  },
  searchBtnText: { fontFamily: MONO, color: C.teal, fontSize: 9, fontWeight: "900", letterSpacing: 2 },

  toggleCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 16, gap: 12,
  },
  toggleTitle: { color: C.textPrimary, fontSize: 14, fontFamily: SANS_700 },
  toggleSub:   { color: C.textDim, fontSize: 11 },

  memberCard: {
    backgroundColor: C.bgCard, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    padding: 14, gap: 10,
  },
  memberHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  memberNum:    { fontFamily: MONO, color: C.purple, fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  removeBtn:    { fontFamily: MONO, color: C.danger, fontSize: 9, letterSpacing: 1 },

  memberRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  shareBox:  { flexDirection: "row", alignItems: "center", gap: 4 },
  shareInput:{ width: 56, textAlign: "center", color: C.waiting, paddingHorizontal: 8 },
  sharePct:  { fontFamily: MONO, color: C.textDim, fontSize: 13 },

  addRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: -4,
  },
  addBtn: {
    borderWidth: 1, borderColor: C.purple + "80",
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: C.purple + "22",
  },
  addBtnText:     { fontFamily: MONO, color: C.purple, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  shareTotalTxt:  { fontFamily: MONO, fontSize: 12, fontWeight: "900" },

  createBtn: {
    backgroundColor: C.purple, borderRadius: 12,
    padding: 18, alignItems: "center",
    shadowColor: C.purple, shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 6,
  },
  createBtnText: { color: "#fff", fontFamily: SANS_900, fontSize: 15, letterSpacing: 3 },

  // Success
  successCard: { marginTop: 32, alignItems: "center", gap: 16 },
  successIcon:  { fontSize: 52, opacity: 0.9 },
  successTitle: { color: C.green, fontSize: 18, fontFamily: SANS_900, letterSpacing: 4 },
  successName:  { color: C.textSecondary, fontSize: 13, fontFamily: MONO },
  successIdBox: {
    width: "100%", backgroundColor: C.bgCard,
    borderRadius: 14, borderWidth: 1, borderColor: C.green + "50",
    padding: 20, gap: 8, alignItems: "center",
  },
  successIdLabel:{ fontFamily: MONO, color: C.textDim, fontSize: 9, letterSpacing: 4 },
  successId:     { fontFamily: MONO, color: C.green, fontSize: 32, fontWeight: "900" },
  successIdHint: { color: C.textDim, fontSize: 11, textAlign: "center" },
  backBtn: {
    borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24,
    marginTop: 8,
  },
  backBtnText: { fontFamily: MONO, color: C.textSecondary, fontSize: 11, letterSpacing: 2 },
});
