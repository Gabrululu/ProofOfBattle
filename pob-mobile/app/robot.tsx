import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, Href } from "expo-router";
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  connection, getRobotPDA, serializeRegisterRobot, confirmWithTimeout,
} from "../lib/program";
import { PROGRAM_ID, BRIDGE_BASE_URL } from "../lib/constants";
import { useWallet } from "../hooks/useWallet";
import { useRobots } from "../hooks/useRobot";
import { WalletButton } from "../components/WalletButton";
import { toast } from "../components/Toast";
import { C, MONO, SANS_900 } from "../lib/theme";

const PRESETS = [
  { id: "balanced",  label: "BALANCED",  attack: 70, defense: 70, speed: 70, desc: "Well-rounded fighter" },
  { id: "tank",      label: "TANK",       attack: 85, defense: 95, speed: 30, desc: "Absorbs punishment"  },
  { id: "speedy",    label: "SPEEDY",     attack: 60, defense: 50, speed: 100, desc: "Strike and evade"   },
  { id: "berserker", label: "BERSERKER",  attack: 100, defense: 45, speed: 65, desc: "Pure aggression"    },
];

const CATEGORIES = ["SUMO", "COMBAT", "LINE FOLLOW", "MAZE", "BATTLE ROYALE"] as const;

// ── Build-a-robot tools ───────────────────────────────────────────────────────

const STAT_BUDGET = 210;   // matches the total of every PRESET above
const STAT_MIN    = 10;
const STAT_MAX    = 100;
const STAT_STEP   = 5;

type Stats = { attack: number; defense: number; speed: number };
type SavedLoadout = Stats & { id: string; label: string };
const LOADOUTS_KEY = "pob_custom_loadouts";

const NAME_PREFIXES = ["IRON", "TITAN", "VIPER", "CHROME", "OMEGA", "ROGUE", "STEEL", "VOLT", "GHOST", "APEX"];
const NAME_SUFFIXES = ["CRUSHER", "REAPER", "STORM", "FURY", "WRECKER", "HAVOC", "BLADE", "STRIKE", "PROTOCOL", "ENGINE"];

function randomRobotName(): string {
  const p = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const s = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  return `${p}-${s}`;
}

function buildTip({ attack, defense, speed }: Stats): string {
  if (attack >= defense && attack >= speed) {
    return "⚔ High ATK hits hard early — keep enough DEF to survive the exchanges it invites.";
  }
  if (defense >= attack && defense >= speed) {
    return "🛡 High DEF wins wars of attrition — pair it with enough SPD so you're not just standing still.";
  }
  return "⚡ High SPD lets you dictate range and disengage — spend the openings you create on ATK.";
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={sty.statRow}>
      <Text style={sty.statLabel}>{label}</Text>
      <View style={sty.barBg}>
        <View style={[sty.barFill, { width: `${value}%` as unknown as number, backgroundColor: color }]} />
      </View>
      <Text style={[sty.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function RobotScreen() {
  const router = useRouter();
  const { publicKey, connect, disconnect, connecting, isWebPreview, authorizeSession } = useWallet();
  const { robots, selectedRobot, selectRobot, loading, reload } = useRobots(publicKey);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(PRESETS[0]);
  const [isCustom, setIsCustom] = useState(false);
  const [customStats, setCustomStats] = useState<Stats>({ attack: 70, defense: 70, speed: 70 });
  const [categories, setCategories] = useState<string[]>([]);
  const [minting, setMinting] = useState(false);
  const [savedLoadouts, setSavedLoadouts] = useState<SavedLoadout[]>([]);

  const activeStats: Stats = isCustom ? customStats : preset;
  const pointsUsed = customStats.attack + customStats.defense + customStats.speed;
  const pointsLeft = STAT_BUDGET - pointsUsed;

  useEffect(() => {
    AsyncStorage.getItem(LOADOUTS_KEY)
      .then((raw) => { if (raw) setSavedLoadouts(JSON.parse(raw)); })
      .catch(() => {});
  }, []);

  // Open the form automatically the first time we learn this wallet has no robots yet.
  useEffect(() => {
    if (!loading && robots.length === 0) setFormOpen(true);
  }, [loading, robots.length]);

  const persistLoadouts = async (next: SavedLoadout[]) => {
    setSavedLoadouts(next);
    await AsyncStorage.setItem(LOADOUTS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const adjustCustomStat = (stat: keyof Stats, delta: number) => {
    setCustomStats((prev) => {
      const nextValue = prev[stat] + delta;
      if (nextValue < STAT_MIN || nextValue > STAT_MAX) return prev;
      const next = { ...prev, [stat]: nextValue };
      if (next.attack + next.defense + next.speed > STAT_BUDGET) return prev;
      return next;
    });
  };

  const saveCurrentLoadout = () => {
    const label = `BUILD ${savedLoadouts.length + 1}`;
    persistLoadouts([...savedLoadouts, { id: Date.now().toString(), label, ...customStats }]);
  };

  const loadLoadout = (l: SavedLoadout) => {
    setIsCustom(true);
    setCustomStats({ attack: l.attack, defense: l.defense, speed: l.speed });
  };

  const deleteLoadout = (id: string) => {
    persistLoadouts(savedLoadouts.filter((l) => l.id !== id));
  };

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const registerRobot = async () => {
    if (!publicKey) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 32) {
      Alert.alert("Name required", "Enter a name between 1 and 32 characters.");
      return;
    }
    setMinting(true);
    try {
      const [robotPDA] = getRobotPDA(publicKey, trimmed);
      const data = serializeRegisterRobot(trimmed, activeStats.attack, activeStats.defense, activeStats.speed);

      await transact(async (wallet: Parameters<Parameters<typeof transact>[0]>[0]) => {
        await authorizeSession(wallet);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });
        tx.add(new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: robotPDA,                isSigner: false, isWritable: true },
            { pubkey: publicKey,               isSigner: true,  isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }));
        const [signed] = await wallet.signTransactions({ transactions: [tx] });
        const sig = await connection.sendRawTransaction(signed.serialize());
        await confirmWithTimeout(sig, blockhash, lastValidBlockHeight);

        // Save profile to bridge (non-critical)
        fetch(`${BRIDGE_BASE_URL}/api/robot-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: publicKey.toBase58(),
            name: trimmed,
            attack: activeStats.attack,
            defense: activeStats.defense,
            speed: activeStats.speed,
            categories,
          }),
        }).catch(() => {});

        toast.success(`${trimmed} forged on-chain ⚔`, sig.slice(0, 16) + "…");
        reload();
      });
    } catch (e: unknown) {
      toast.error("Transaction failed", e instanceof Error ? e.message : String(e));
    } finally {
      setMinting(false);
    }
  };

  return (
    <SafeAreaView style={sty.safe}>
      <Stack.Screen options={{ title: "MY ROBOT" }} />
      <ScrollView contentContainerStyle={sty.content}>

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

        {!publicKey ? (
          <View style={sty.hint}>
            <Text style={sty.hintText}>Connect your wallet to register a robot.</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
        ) : (
          <>
          {/* ── MY ROBOTS ─────────────────────────────── */}
          {robots.length > 0 && (
            <View style={{ gap: 12 }}>
              {robots.map((r) => (
                <View key={r.pda} style={sty.robotCard}>
                  <View style={sty.robotHeader}>
                    <Text style={sty.robotName}>{r.name}</Text>
                    {selectedRobot?.pda === r.pda ? (
                      <View style={[sty.badge, { backgroundColor: C.green }]}>
                        <Text style={sty.badgeText}>ACTIVE</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={sty.useBtn}
                        onPress={() => selectRobot(r.name)}
                        activeOpacity={0.75}
                      >
                        <Text style={sty.useBtnText}>USE THIS ONE</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={sty.record}>
                    <View style={sty.recordItem}>
                      <Text style={[sty.recordVal, { color: C.green }]}>{r.wins}</Text>
                      <Text style={sty.recordLbl}>WINS</Text>
                    </View>
                    <View style={sty.recordDivider} />
                    <View style={sty.recordItem}>
                      <Text style={[sty.recordVal, { color: C.danger }]}>{r.losses}</Text>
                      <Text style={sty.recordLbl}>LOSSES</Text>
                    </View>
                    <View style={sty.recordDivider} />
                    <View style={sty.recordItem}>
                      <Text style={[sty.recordVal, { color: C.teal }]}>{r.hp}</Text>
                      <Text style={sty.recordLbl}>HP</Text>
                    </View>
                  </View>

                  <View style={sty.stats}>
                    <StatBar label="ATK" value={r.attack}  color={C.danger}  />
                    <StatBar label="DEF" value={r.defense} color={C.teal}    />
                    <StatBar label="SPD" value={r.speed}   color={C.waiting} />
                  </View>

                  <Text style={sty.pdaText}>
                    PDA: {r.pda.slice(0, 8)}…{r.pda.slice(-8)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!formOpen ? (
            <TouchableOpacity
              style={sty.addAnotherBtn}
              onPress={() => setFormOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={sty.addAnotherBtnText}>+ REGISTER ANOTHER ROBOT</Text>
            </TouchableOpacity>
          ) : (
          /* ── REGISTRATION FORM ────────────────────────── */
          <View style={sty.form}>
            <Text style={sty.formTitle}>FORGE YOUR ROBOT</Text>
            <Text style={sty.formSub}>Register your fighter on Solana Devnet.</Text>

            <Text style={sty.fieldLabel}>ROBOT NAME</Text>
            <View style={sty.nameRow}>
              <TextInput
                style={[sty.input, { flex: 1 }]}
                placeholder="UNIT-OMEGA"
                placeholderTextColor={C.textDim}
                value={name}
                onChangeText={setName}
                maxLength={32}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={sty.diceBtn}
                onPress={() => setName(randomRobotName())}
                activeOpacity={0.75}
              >
                <Text style={sty.diceBtnText}>🎲</Text>
              </TouchableOpacity>
            </View>

            <Text style={sty.fieldLabel}>COMBAT CLASS</Text>
            <View style={sty.presetGrid}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[sty.presetBtn, !isCustom && preset.id === p.id && sty.presetBtnActive]}
                  onPress={() => { setIsCustom(false); setPreset(p); }}
                >
                  <Text style={[sty.presetLabel, !isCustom && preset.id === p.id && { color: "#fff" }]}>
                    {p.label}
                  </Text>
                  <Text style={sty.presetDesc}>{p.desc}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[sty.presetBtn, isCustom && sty.presetBtnActive]}
                onPress={() => setIsCustom(true)}
              >
                <Text style={[sty.presetLabel, isCustom && { color: "#fff" }]}>CUSTOM</Text>
                <Text style={sty.presetDesc}>Build your own — {STAT_BUDGET} pt budget</Text>
              </TouchableOpacity>
            </View>

            {isCustom ? (
              <View style={sty.stats}>
                <View style={sty.customHeaderRow}>
                  <Text style={sty.statsTitle}>CUSTOM BUILD</Text>
                  <Text style={[sty.pointsLeft, pointsLeft === 0 && { color: C.green }]}>
                    {pointsLeft} PTS LEFT
                  </Text>
                </View>
                {([
                  { key: "attack" as const,  label: "ATK", color: C.danger },
                  { key: "defense" as const, label: "DEF", color: C.teal },
                  { key: "speed" as const,   label: "SPD", color: C.waiting },
                ]).map(({ key, label, color }) => (
                  <View key={key} style={sty.stepperRow}>
                    <Text style={sty.statLabel}>{label}</Text>
                    <TouchableOpacity
                      style={sty.stepBtn}
                      onPress={() => adjustCustomStat(key, -STAT_STEP)}
                    >
                      <Text style={sty.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <View style={sty.barBg}>
                      <View style={[sty.barFill, { width: `${customStats[key]}%` as unknown as number, backgroundColor: color }]} />
                    </View>
                    <TouchableOpacity
                      style={sty.stepBtn}
                      onPress={() => adjustCustomStat(key, STAT_STEP)}
                    >
                      <Text style={sty.stepBtnText}>+</Text>
                    </TouchableOpacity>
                    <Text style={[sty.statValue, { color }]}>{customStats[key]}</Text>
                  </View>
                ))}

                <TouchableOpacity style={sty.saveLoadoutBtn} onPress={saveCurrentLoadout} activeOpacity={0.8}>
                  <Text style={sty.saveLoadoutBtnText}>💾 SAVE BUILD</Text>
                </TouchableOpacity>

                {savedLoadouts.length > 0 && (
                  <View style={sty.loadoutGrid}>
                    {savedLoadouts.map((l) => (
                      <View key={l.id} style={sty.loadoutChip}>
                        <TouchableOpacity onPress={() => loadLoadout(l)} activeOpacity={0.75}>
                          <Text style={sty.loadoutChipText}>{l.label}</Text>
                          <Text style={sty.loadoutChipStats}>
                            {l.attack}/{l.defense}/{l.speed}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteLoadout(l.id)} hitSlop={8}>
                          <Text style={sty.loadoutChipDelete}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={sty.stats}>
                <StatBar label="ATK" value={preset.attack}  color={C.danger}  />
                <StatBar label="DEF" value={preset.defense} color={C.teal}    />
                <StatBar label="SPD" value={preset.speed}   color={C.waiting} />
              </View>
            )}

            <View style={sty.tipCard}>
              <Text style={sty.tipText}>{buildTip(activeStats)}</Text>
            </View>

            <TouchableOpacity
              style={sty.resourcesLink}
              onPress={() => router.push("/resources" as Href)}
              activeOpacity={0.75}
            >
              <Text style={sty.resourcesLinkText}>🛠 Need build inspiration? See Builder Resources →</Text>
            </TouchableOpacity>

            {/* Competition categories */}
            <Text style={sty.fieldLabel}>COMPETITION CATEGORIES</Text>
            <Text style={sty.fieldHint}>Select categories this robot is designed for</Text>
            <View style={sty.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[sty.catChip, categories.includes(cat) && sty.catChipActive]}
                  onPress={() => toggleCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[sty.catChipText, categories.includes(cat) && { color: "#fff" }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {categories.length > 0 && (
              <Text style={sty.catSelected}>
                Selected: {categories.join(" · ")}
              </Text>
            )}

            <TouchableOpacity
              style={[sty.forgeBtn, minting && { opacity: 0.6 }]}
              onPress={registerRobot}
              disabled={minting}
            >
              {minting
                ? <ActivityIndicator color="#000" />
                : <Text style={sty.forgeBtnText}>⚔ FORGE ROBOT ON-CHAIN</Text>
              }
            </TouchableOpacity>
          </View>
          )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const sty = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, gap: 16, paddingBottom: 48 },

  walletRow: { alignItems: "center" },
  hint:      { alignItems: "center", marginTop: 32 },
  hintText:  { color: C.textDim, fontFamily: MONO, fontSize: 12 },

  // Existing robot card
  robotCard: {
    backgroundColor: C.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, padding: 18, gap: 16,
  },
  robotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  robotName:   { color: C.textPrimary, fontSize: 22, fontFamily: SANS_900, letterSpacing: 3 },
  badge:       { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { color: "#000", fontFamily: SANS_900, fontSize: 9, letterSpacing: 1 },

  record:       { flexDirection: "row", backgroundColor: C.bg, borderRadius: 8, padding: 12 },
  recordItem:   { flex: 1, alignItems: "center", gap: 4 },
  recordDivider:{ width: 1, backgroundColor: C.border },
  recordVal:    { fontFamily: MONO, fontSize: 24, fontWeight: "900" },
  recordLbl:    { fontFamily: MONO, color: C.textDim, fontSize: 8, letterSpacing: 2 },
  pdaText:      { fontFamily: MONO, color: C.textDim, fontSize: 9, textAlign: "center" },

  useBtn: {
    borderWidth: 1, borderColor: C.border, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  useBtnText: { fontFamily: MONO, color: C.textDim, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },

  addAnotherBtn: {
    borderWidth: 1, borderColor: C.purple + "60", backgroundColor: C.purple + "15",
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  addAnotherBtnText: { fontFamily: MONO, color: C.purple, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

  // Form
  form:       { gap: 14 },
  formTitle:  { color: C.textPrimary, fontSize: 20, fontFamily: SANS_900, letterSpacing: 3 },
  formSub:    { color: C.textSecondary, fontSize: 12 },
  fieldLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 3 },
  fieldHint:  { color: C.textDim, fontSize: 11, marginTop: -8 },
  input: {
    backgroundColor: C.bgCard, borderRadius: 8, borderWidth: 1,
    borderColor: C.border, padding: 14, color: C.textPrimary,
    fontFamily: MONO, fontSize: 16, letterSpacing: 2,
  },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetBtn: {
    width: "47%", backgroundColor: C.bgCard, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, padding: 12, gap: 4,
  },
  presetBtnActive: { backgroundColor: C.purple, borderColor: C.purple },
  presetLabel:     { color: C.textSecondary, fontFamily: SANS_900, fontSize: 11, letterSpacing: 1 },
  presetDesc:      { color: C.textDim, fontSize: 10 },

  // Stats
  stats:      { gap: 8 },
  statsTitle: { fontFamily: MONO, color: C.textDim, fontSize: 8, fontWeight: "800", letterSpacing: 4 },
  statRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  statLabel:  { fontFamily: MONO, color: C.textDim, fontSize: 9, width: 28, letterSpacing: 1 },
  barBg:      { flex: 1, height: 6, backgroundColor: C.bgAccent, borderRadius: 3, overflow: "hidden" },
  barFill:    { height: "100%", borderRadius: 3 },
  statValue:  { fontFamily: MONO, fontSize: 11, fontWeight: "700", width: 28, textAlign: "right" },

  // Name generator
  nameRow: { flexDirection: "row", gap: 8 },
  diceBtn: {
    width: 48, alignItems: "center", justifyContent: "center",
    backgroundColor: C.bgCard, borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  diceBtnText: { fontSize: 18 },

  // Custom build (point-buy)
  customHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pointsLeft:       { fontFamily: MONO, color: C.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  stepperRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bgCard, alignItems: "center", justifyContent: "center",
  },
  stepBtnText: { color: C.textPrimary, fontFamily: SANS_900, fontSize: 14, lineHeight: 16 },

  saveLoadoutBtn: {
    borderWidth: 1, borderColor: C.purple + "60", backgroundColor: C.purple + "15",
    borderRadius: 8, paddingVertical: 8, alignItems: "center", marginTop: 4,
  },
  saveLoadoutBtnText: { fontFamily: MONO, color: C.purple, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },

  loadoutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  loadoutChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    backgroundColor: C.bgCard, paddingVertical: 6, paddingHorizontal: 10,
  },
  loadoutChipText:   { fontFamily: MONO, color: C.textPrimary, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  loadoutChipStats:  { fontFamily: MONO, color: C.textDim, fontSize: 8, marginTop: 1 },
  loadoutChipDelete: { color: C.textDim, fontSize: 12, paddingHorizontal: 2 },

  // Build tip
  tipCard: {
    backgroundColor: C.bgAccent, borderRadius: 8, borderWidth: 1, borderColor: C.border,
    padding: 12,
  },
  tipText: { color: C.textSecondary, fontSize: 11, lineHeight: 16 },

  // Resources link
  resourcesLink: { alignItems: "center", paddingVertical: 4 },
  resourcesLinkText: { fontFamily: MONO, color: C.teal, fontSize: 10, letterSpacing: 0.5 },

  // Categories
  catGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: {
    borderWidth: 1, borderColor: C.border, borderRadius: 20,
    paddingVertical: 7, paddingHorizontal: 14,
    backgroundColor: C.bgCard,
  },
  catChipActive: { backgroundColor: C.purple, borderColor: C.purple },
  catChipText:   { fontFamily: MONO, color: C.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  catSelected:   { fontFamily: MONO, color: C.purple, fontSize: 10, letterSpacing: 0.5 },

  // Forge button
  forgeBtn: {
    backgroundColor: C.purple, borderRadius: 10,
    padding: 16, alignItems: "center",
    shadowColor: C.purple, shadowOpacity: 0.4, shadowRadius: 10,
    elevation: 6, marginTop: 4,
  },
  forgeBtnText: { color: "#fff", fontFamily: SANS_900, fontSize: 14, letterSpacing: 2 },
});
