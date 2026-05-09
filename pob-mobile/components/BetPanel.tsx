import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import {
  PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, TransactionInstruction,
} from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { connection, getBattlePDA, getVaultPDA, getBetPDA } from "../lib/program";
import { PROGRAM_ID } from "../lib/constants";
import { C } from "../lib/theme";

const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);
const AMOUNTS = ["0.05", "0.1", "0.5", "1"];

interface Props {
  battleId:   number;
  publicKey:  PublicKey | null;
  totalBetsA: number;
  totalBetsB: number;
}

export function BetPanel({ battleId, publicKey, totalBetsA, totalBetsB }: Props) {
  const [side,    setSide]    = useState<0 | 1 | null>(null);
  const [amount,  setAmount]  = useState("0.1");
  const [loading, setLoading] = useState(false);

  const totalPool = totalBetsA + totalBetsB;
  const oddsA = totalPool > 0 ? ((totalBetsA / totalPool) * 100).toFixed(0) : "50";
  const oddsB = totalPool > 0 ? ((totalBetsB / totalPool) * 100).toFixed(0) : "50";

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
            { pubkey: battlePDA,                  isSigner: false, isWritable: true },
            { pubkey: betPDA,                     isSigner: false, isWritable: true },
            { pubkey: vaultPDA,                   isSigner: false, isWritable: true },
            { pubkey: publicKey,                  isSigner: true,  isWritable: true },
            { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false },
          ],
          data,
        }));
        const [signed] = await wallet.signTransactions({ transactions: [tx] });
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        Alert.alert("Bet placed!", `${amount} SOL on Robot ${side === 0 ? "A" : "B"}\n${sig.slice(0, 16)}…`);
      });
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Connect wallet to place bets</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>PLACE YOUR BET</Text>

      {/* Pool */}
      <Text style={styles.pool}>
        Total pool — {(totalPool / LAMPORTS_PER_SOL).toFixed(3)} SOL
      </Text>

      {/* Side selector */}
      <View style={styles.sideRow}>
        <TouchableOpacity
          style={[styles.sideBtn, side === 0 && { backgroundColor: C.robotA, borderColor: C.robotA }]}
          onPress={() => setSide(0)}
        >
          <Text style={styles.sideBtnLabel}>ROBOT A</Text>
          <Text style={styles.sideOdds}>{oddsA}%</Text>
        </TouchableOpacity>

        <View style={styles.vsSmall}><Text style={styles.vsText}>VS</Text></View>

        <TouchableOpacity
          style={[styles.sideBtn, { borderColor: C.robotB }, side === 1 && { backgroundColor: C.robotB, borderColor: C.robotB }]}
          onPress={() => setSide(1)}
        >
          <Text style={styles.sideBtnLabel}>ROBOT B</Text>
          <Text style={styles.sideOdds}>{oddsB}%</Text>
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
              {v}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Confirm */}
      <TouchableOpacity
        style={[styles.betBtn, side === null && styles.betBtnDisabled]}
        onPress={placeBet}
        disabled={loading || side === null}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.betBtnText}>
            BET {amount} SOL{side !== null ? ` · ROBOT ${side === 0 ? "A" : "B"}` : ""}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    padding: 20,
  },
  emptyText: { color: C.textDim, fontSize: 13 },

  panel: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    gap: 12,
  },
  title: {
    color: C.green,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign: "center",
  },
  pool: {
    color: C.textSecondary,
    fontSize: 11,
    textAlign: "center",
  },

  sideRow: {
    flexDirection:  "row",
    alignItems:     "center",
    gap: 8,
  },
  sideBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: C.robotA,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  sideBtnLabel: { color: C.textPrimary, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  sideOdds:    { color: C.textSecondary, fontSize: 10 },
  vsSmall:     { paddingHorizontal: 4 },
  vsText:      { color: C.textDim, fontSize: 11, fontWeight: "700" },

  amountRow: {
    flexDirection: "row",
    gap: 6,
  },
  chip: {
    flex: 1,
    backgroundColor: C.bgAccent,
    borderRadius: 7,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.purple,
    borderColor: C.purple,
    shadowColor: C.purple,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  chipText:       { color: C.textSecondary, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  betBtn: {
    backgroundColor: C.purple,
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    shadowColor: C.purple,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  betBtnDisabled: {
    backgroundColor: C.bgAccent,
    shadowOpacity: 0,
    elevation: 0,
  },
  betBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1,
  },
});
