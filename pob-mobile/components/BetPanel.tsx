import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import {
  PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, TransactionInstruction,
} from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { connection, getBattlePDA, getVaultPDA, getBetPDA } from "../lib/program";
import { PROGRAM_ID } from "../lib/constants";
import { C, MONO } from "../lib/theme";
import { useWallet } from "../hooks/useWallet";
import { toast } from "./Toast";

const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);
const AMOUNTS = ["0.05", "0.1", "0.5", "1"];

interface Props {
  battleId:   number;
  publicKey:  PublicKey | null;
  totalBetsA: number;
  totalBetsB: number;
  nameA?: string;
  nameB?: string;
}

export function BetPanel({ battleId, publicKey, totalBetsA, totalBetsB, nameA = "ROBOT A", nameB = "ROBOT B" }: Props) {
  const { connect, connecting } = useWallet();
  const [side,    setSide]    = useState<0 | 1 | null>(null);
  const [amount,  setAmount]  = useState("0.1");
  const [loading, setLoading] = useState(false);

  const totalPool = totalBetsA + totalBetsB;
  const pctA = totalPool > 0 ? (totalBetsA / totalPool) * 100 : 50;
  const pctB = 100 - pctA;
  const oddsA = pctA.toFixed(0);
  const oddsB = pctB.toFixed(0);

  const placeBet = async () => {
    if (!publicKey || side === null) return;
    setLoading(true);
    try {
      const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
      const [battlePDA] = getBattlePDA(battleId);
      const [vaultPDA]  = getVaultPDA(battleId);
      const [betPDA]    = getBetPDA(battleId, publicKey);

      const battleIdBuf = Buffer.alloc(8);
      battleIdBuf.writeBigUInt64LE(BigInt(battleId));
      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(BigInt(lamports));
      const data = Buffer.concat([
        PLACE_BET_DISCRIMINATOR, battleIdBuf, Buffer.from([side]), amountBuf,
      ]);

      await transact(async (wallet: any) => {
        const { blockhash } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });
        tx.add(new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: battlePDA,               isSigner: false, isWritable: true  },
            { pubkey: betPDA,                  isSigner: false, isWritable: true  },
            { pubkey: vaultPDA,                isSigner: false, isWritable: true  },
            { pubkey: publicKey,               isSigner: true,  isWritable: true  },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }));
        const [signed] = await wallet.signTransactions({ transactions: [tx] });
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        toast.success(
          `Bet placed — ${amount} SOL on Robot ${side === 0 ? "A" : "B"}`,
          sig.slice(0, 16) + "…",
        );
      });
    } catch (e: unknown) {
      toast.error("Bet failed", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.panel}>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerDot} />
        <Text style={styles.title}>PLACE YOUR BET</Text>
        <View style={styles.headerDot} />
      </View>

      {/* Pool bar — always visible so spectators see the odds before connecting */}
      <View style={styles.poolSection}>
        <View style={styles.poolLabels}>
          <Text style={[styles.poolSide, { color: C.robotA }]} numberOfLines={1}>{nameA}  {oddsA}%</Text>
          <Text style={[styles.poolTotal, { color: C.teal }]}>
            {(totalPool / LAMPORTS_PER_SOL).toFixed(3)} SOL
          </Text>
          <Text style={[styles.poolSide, { color: C.robotB, textAlign: "right" }]} numberOfLines={1}>
            {oddsB}%  {nameB}
          </Text>
        </View>
        <View style={styles.poolBar}>
          <View style={[styles.poolFillA, { flex: pctA }]} />
          <View style={[styles.poolFillB, { flex: pctB }]} />
        </View>
      </View>

      {/* Not connected — show connect CTA inline */}
      {!publicKey ? (
        <View style={styles.connectBox}>
          <Text style={styles.connectHint}>Connect your wallet to bet on the winner</Text>
          <TouchableOpacity
            style={styles.connectBtn}
            onPress={connect}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.connectBtnText}>CONNECT WALLET →</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Side selector */}
          <View style={styles.sideRow}>
            <TouchableOpacity
              style={[styles.sideBtn, { borderColor: C.robotA },
                side === 0 && { backgroundColor: C.robotA }]}
              onPress={() => setSide(0)}
              activeOpacity={0.8}
            >
              <Text style={styles.sideBtnLabel} numberOfLines={1}>{nameA}</Text>
              <Text style={[styles.sideOdds, side === 0 && { color: "#fff" }]}>
                {oddsA}% of pool
              </Text>
            </TouchableOpacity>

            <View style={styles.vsSmall}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            <TouchableOpacity
              style={[styles.sideBtn, { borderColor: C.robotB },
                side === 1 && { backgroundColor: C.robotB }]}
              onPress={() => setSide(1)}
              activeOpacity={0.8}
            >
              <Text style={styles.sideBtnLabel} numberOfLines={1}>{nameB}</Text>
              <Text style={[styles.sideOdds, side === 1 && { color: "#fff" }]}>
                {oddsB}% of pool
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount chips */}
          <View style={styles.amountRow}>
            {AMOUNTS.map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.chip, amount === v && styles.chipActive]}
                onPress={() => setAmount(v)}
              >
                <Text style={[styles.chipText, amount === v && styles.chipTextActive]}>
                  {v} SOL
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payout estimate */}
          {side !== null && totalPool > 0 && (
            <Text style={styles.estimate}>
              Est. return if Robot {side === 0 ? "A" : "B"} wins:{" "}
              <Text style={{ color: C.green }}>
                {((parseFloat(amount) * totalPool * 0.95) /
                  (side === 0 ? totalBetsA : totalBetsB) /
                  LAMPORTS_PER_SOL).toFixed(3)} SOL
              </Text>
            </Text>
          )}

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.betBtn, side === null && styles.betBtnDisabled]}
            onPress={placeBet}
            disabled={loading || side === null}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.betBtnText}>
                {side !== null
                  ? `BET ${amount} SOL ON ${side === 0 ? nameA : nameB} →`
                  : "SELECT A ROBOT TO BET"}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: C.bgCard,
    borderRadius:    14,
    padding:         18,
    borderWidth:     1,
    borderColor:     C.border,
    gap:             14,
  },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerDot: { flex: 1, height: 1, backgroundColor: C.border },
  title: {
    fontFamily:  MONO,
    color:       C.green,
    fontSize:    11,
    fontWeight:  "900",
    letterSpacing: 3,
  },

  // Pool bar
  poolSection: { gap: 8 },
  poolLabels:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  poolSide: {
    fontFamily: MONO, fontSize: 10, fontWeight: "800", letterSpacing: 1, flex: 1,
  },
  poolTotal: {
    fontFamily: MONO, fontSize: 11, fontWeight: "700", textAlign: "center",
  },
  poolBar: {
    flexDirection: "row",
    height:        10,
    borderRadius:  5,
    overflow:      "hidden",
    backgroundColor: C.bgAccent,
  },
  poolFillA: { backgroundColor: C.robotA, borderRadius: 5 },
  poolFillB: { backgroundColor: C.robotB, borderRadius: 5 },

  // Connect CTA
  connectBox: { gap: 12, alignItems: "center", paddingVertical: 8 },
  connectHint: {
    fontFamily: MONO, color: C.textSecondary,
    fontSize: 12, textAlign: "center", lineHeight: 18,
  },
  connectBtn: {
    backgroundColor: C.purple,
    borderRadius:    10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    shadowColor: C.purple,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  connectBtnText: {
    color: "#fff", fontWeight: "900",
    fontSize: 13, letterSpacing: 3,
  },

  // Side selector
  sideRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sideBtn: {
    flex: 1, borderWidth: 1.5,
    borderRadius: 10, padding: 14,
    alignItems: "center", gap: 4,
    backgroundColor: C.bgAccent,
  },
  sideBtnLabel: {
    color: C.textPrimary, fontWeight: "900",
    fontSize: 13, letterSpacing: 1,
  },
  sideOdds: { color: C.textDim, fontFamily: MONO, fontSize: 10 },
  vsSmall:  { paddingHorizontal: 2 },
  vsText:   { color: C.textDim, fontSize: 11, fontWeight: "700" },

  // Amount
  amountRow: { flexDirection: "row", gap: 6 },
  chip: {
    flex: 1, backgroundColor: C.bgAccent,
    borderRadius: 8, paddingVertical: 10,
    alignItems: "center", borderWidth: 1, borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.purple, borderColor: C.purple,
    shadowColor: C.purple, shadowOpacity: 0.4,
    shadowRadius: 8, elevation: 4,
  },
  chipText:       { fontFamily: MONO, color: C.textSecondary, fontSize: 10, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  // Estimate
  estimate: {
    fontFamily: MONO, color: C.textDim,
    fontSize: 10, textAlign: "center",
  },

  // Bet button
  betBtn: {
    backgroundColor: C.purple, borderRadius: 10,
    padding: 16, alignItems: "center",
    shadowColor: C.purple, shadowOpacity: 0.45,
    shadowRadius: 12, elevation: 6,
  },
  betBtnDisabled: {
    backgroundColor: C.bgAccent, shadowOpacity: 0, elevation: 0,
  },
  betBtnText: {
    color: "#fff", fontWeight: "900",
    fontSize: 13, letterSpacing: 2,
  },
});
