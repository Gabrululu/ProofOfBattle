import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  connection, getRobotPDA, serializeRegisterRobot,
} from "../lib/program";
import { PROGRAM_ID } from "../lib/constants";
import { useWallet } from "../hooks/useWallet";
import { useRobot } from "../hooks/useRobot";
import { WalletButton } from "../components/WalletButton";
import { C, MONO } from "../lib/theme";

const PRESETS = [
  { id: "balanced",  label: "BALANCED",  attack: 70, defense: 70, speed: 70, desc: "Well-rounded fighter" },
  { id: "tank",      label: "TANK",       attack: 85, defense: 95, speed: 30, desc: "Absorbs punishment"  },
  { id: "speedy",    label: "SPEEDY",     attack: 60, defense: 50, speed: 100, desc: "Strike and evade"   },
  { id: "berserker", label: "BERSERKER",  attack: 100, defense: 45, speed: 65, desc: "Pure aggression"    },
];

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={sty.statRow}>
      <Text style={sty.statLabel}>{label}</Text>
      <View style={sty.barBg}>
        <View style={[sty.barFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[sty.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function RobotScreen() {
  const { publicKey, connect, disconnect, connecting, isWebPreview } = useWallet();
  const { robot, loading, reload } = useRobot(publicKey);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState(PRESETS[0]);
  const [minting, setMinting] = useState(false);

  const registerRobot = async () => {
    if (!publicKey) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 20) {
      Alert.alert("Name required", "Enter a name between 1 and 20 characters.");
      return;
    }
    setMinting(true);
    try {
      const [robotPDA] = getRobotPDA(publicKey);
      const data = serializeRegisterRobot(trimmed, preset.attack, preset.defense, preset.speed);

      await transact(async (wallet: any) => {
        const { blockhash } = await connection.getLatestBlockhash();
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
        await connection.confirmTransaction(sig, "confirmed");
        Alert.alert("Robot forged!", `${trimmed} is now on-chain.\n${sig.slice(0, 16)}…`);
        reload();
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Error", msg);
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
        ) : robot ? (
          /* ── ROBOT EXISTS ─────────────────────────────── */
          <View style={sty.robotCard}>
            <View style={sty.robotHeader}>
              <Text style={sty.robotName}>{robot.name}</Text>
              <View style={[sty.badge, { backgroundColor: robot.isActive ? C.green : C.textDim }]}>
                <Text style={sty.badgeText}>{robot.isActive ? "ACTIVE" : "STANDBY"}</Text>
              </View>
            </View>

            <View style={sty.record}>
              <View style={sty.recordItem}>
                <Text style={[sty.recordVal, { color: C.green }]}>{robot.wins}</Text>
                <Text style={sty.recordLbl}>WINS</Text>
              </View>
              <View style={sty.recordDivider} />
              <View style={sty.recordItem}>
                <Text style={[sty.recordVal, { color: C.danger }]}>{robot.losses}</Text>
                <Text style={sty.recordLbl}>LOSSES</Text>
              </View>
              <View style={sty.recordDivider} />
              <View style={sty.recordItem}>
                <Text style={[sty.recordVal, { color: C.teal }]}>{robot.hp}</Text>
                <Text style={sty.recordLbl}>HP</Text>
              </View>
            </View>

            <View style={sty.stats}>
              <Text style={sty.statsTitle}>COMBAT SPECS</Text>
              <StatBar label="ATK" value={robot.attack}  color={C.danger}  />
              <StatBar label="DEF" value={robot.defense} color={C.teal}    />
              <StatBar label="SPD" value={robot.speed}   color={C.waiting} />
            </View>

            <Text style={sty.pdaText}>
              PDA: {robot.pda.slice(0, 8)}…{robot.pda.slice(-8)}
            </Text>
          </View>
        ) : (
          /* ── REGISTRATION FORM ────────────────────────── */
          <View style={sty.form}>
            <Text style={sty.formTitle}>FORGE YOUR ROBOT</Text>
            <Text style={sty.formSub}>Register your fighter on Solana Devnet.</Text>

            <Text style={sty.fieldLabel}>ROBOT NAME</Text>
            <TextInput
              style={sty.input}
              placeholder="UNIT-OMEGA"
              placeholderTextColor={C.textDim}
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoCapitalize="characters"
            />

            <Text style={sty.fieldLabel}>COMBAT CLASS</Text>
            <View style={sty.presetGrid}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[sty.presetBtn, preset.id === p.id && sty.presetBtnActive]}
                  onPress={() => setPreset(p)}
                >
                  <Text style={[sty.presetLabel, preset.id === p.id && { color: "#fff" }]}>
                    {p.label}
                  </Text>
                  <Text style={sty.presetDesc}>{p.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={sty.stats}>
              <StatBar label="ATK" value={preset.attack}  color={C.danger}  />
              <StatBar label="DEF" value={preset.defense} color={C.teal}    />
              <StatBar label="SPD" value={preset.speed}   color={C.waiting} />
            </View>

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
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    gap: 16,
  },
  robotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  robotName:   { color: C.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  badge:       { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:   { color: "#000", fontWeight: "900", fontSize: 9, letterSpacing: 1 },

  record:       { flexDirection: "row", backgroundColor: "#050510", borderRadius: 8, padding: 12 },
  recordItem:   { flex: 1, alignItems: "center", gap: 4 },
  recordDivider:{ width: 1, backgroundColor: C.border },
  recordVal:    { fontFamily: MONO, fontSize: 24, fontWeight: "900" },
  recordLbl:    { fontFamily: MONO, color: C.textDim, fontSize: 8, letterSpacing: 2 },

  pdaText: { fontFamily: MONO, color: C.textDim, fontSize: 9, textAlign: "center" },

  // Form
  form:       { gap: 14 },
  formTitle:  { color: C.textPrimary, fontSize: 20, fontWeight: "900", letterSpacing: 3 },
  formSub:    { color: C.textSecondary, fontSize: 12 },
  fieldLabel: { fontFamily: MONO, color: C.textDim, fontSize: 9, fontWeight: "800", letterSpacing: 3 },
  input: {
    backgroundColor: C.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    color: C.textPrimary,
    fontFamily: MONO,
    fontSize: 16,
    letterSpacing: 2,
  },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetBtn: {
    width: "47%",
    backgroundColor: C.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 4,
  },
  presetBtnActive: { backgroundColor: C.purple, borderColor: C.purple },
  presetLabel: { color: C.textSecondary, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  presetDesc:  { color: C.textDim, fontSize: 10 },

  // Stats
  stats:      { gap: 8 },
  statsTitle: { fontFamily: MONO, color: C.textDim, fontSize: 8, fontWeight: "800", letterSpacing: 4 },
  statRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  statLabel:  { fontFamily: MONO, color: C.textDim, fontSize: 9, width: 28, letterSpacing: 1 },
  barBg:      { flex: 1, height: 6, backgroundColor: C.bgAccent, borderRadius: 3, overflow: "hidden" },
  barFill:    { height: "100%", borderRadius: 3 },
  statValue:  { fontFamily: MONO, fontSize: 11, fontWeight: "700", width: 28, textAlign: "right" },

  forgeBtn: {
    backgroundColor: C.purple,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    shadowColor: C.purple,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 4,
  },
  forgeBtnText: { color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 2 },
});
