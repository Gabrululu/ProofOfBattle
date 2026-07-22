import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import {
  PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  connection, getBattlePDA, getVaultPDA, getBetPDA, confirmWithTimeout,
  getBetTokenPDA, getVaultAuthorityPDA, getVaultTokenPDA, serializePlaceBetToken,
} from "../lib/program";
import { PROGRAM_ID, USDC_MINT, USDC_DECIMALS } from "../lib/constants";
import { C, MONO, SANS_700, SANS_900 } from "../lib/theme";
import { useWallet } from "../hooks/useWallet";
import { toast } from "./Toast";

const PLACE_BET_DISCRIMINATOR = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);
type Currency = "SOL" | "USDC";

interface Props {
  battleId:        number;
  publicKey:       PublicKey | null;
  totalBackA:      number;
  totalBackB:      number;
  totalBackAUsdc:  number;
  totalBackBUsdc:  number;
  nameA?: string;
  nameB?: string;
}

export function BackPanel({
  battleId, publicKey, totalBackA, totalBackB, totalBackAUsdc, totalBackBUsdc,
  nameA = "ROBOT A", nameB = "ROBOT B",
}: Props) {
  const { connect, connecting, authorizeSession } = useWallet();
  const [currency, setCurrency] = useState<Currency>("SOL");
  const [side,    setSide]    = useState<0 | 1 | null>(null);
  const [amount,  setAmount]  = useState("");
  const [loading, setLoading] = useState(false);

  const [poolA, poolB] = currency === "SOL" ? [totalBackA, totalBackB] : [totalBackAUsdc, totalBackBUsdc];
  const totalPool = poolA + poolB;
  const pctA = totalPool > 0 ? (poolA / totalPool) * 100 : 50;
  const pctB = 100 - pctA;
  const oddsA = pctA.toFixed(0);
  const oddsB = pctB.toFixed(0);
  const amountValue = parseFloat(amount);
  const hasValidAmount = !isNaN(amountValue) && amountValue > 0;
  const decimals = currency === "SOL" ? 9 : USDC_DECIMALS;
  const unitDivisor = currency === "SOL" ? LAMPORTS_PER_SOL : 10 ** USDC_DECIMALS;

  const placeBack = async () => {
    if (!publicKey || side === null || !hasValidAmount) return;
    setLoading(true);
    try {
      const baseUnits = Math.round(amountValue * 10 ** decimals);
      const [battlePDA] = getBattlePDA(battleId);

      await transact(async (wallet: any) => {
        await authorizeSession(wallet);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        if (currency === "SOL") {
          const [vaultPDA] = getVaultPDA(battleId);
          const [betPDA]   = getBetPDA(battleId, publicKey);
          const battleIdBuf = Buffer.alloc(8);
          battleIdBuf.writeBigUInt64LE(BigInt(battleId));
          const amountBuf = Buffer.alloc(8);
          amountBuf.writeBigUInt64LE(BigInt(baseUnits));
          const data = Buffer.concat([PLACE_BET_DISCRIMINATOR, battleIdBuf, Buffer.from([side]), amountBuf]);
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
        } else {
          const [betTokenPDA] = getBetTokenPDA(battleId, USDC_MINT, publicKey);
          const [vaultAuthPDA] = getVaultAuthorityPDA(battleId, USDC_MINT);
          const [vaultTokenPDA] = getVaultTokenPDA(battleId, USDC_MINT);
          const bettorAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
          // Covers first-time USDC backers with no ATA yet — no-op if it already exists.
          tx.add(createAssociatedTokenAccountIdempotentInstruction(publicKey, bettorAta, publicKey, USDC_MINT));
          const data = serializePlaceBetToken(battleId, side, baseUnits);
          tx.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
              { pubkey: battlePDA,                       isSigner: false, isWritable: true  },
              { pubkey: betTokenPDA,                      isSigner: false, isWritable: true  },
              { pubkey: vaultAuthPDA,                     isSigner: false, isWritable: false },
              { pubkey: vaultTokenPDA,                    isSigner: false, isWritable: true  },
              { pubkey: USDC_MINT,                        isSigner: false, isWritable: false },
              { pubkey: bettorAta,                        isSigner: false, isWritable: true  },
              { pubkey: publicKey,                        isSigner: true,  isWritable: true  },
              { pubkey: TOKEN_PROGRAM_ID,                 isSigner: false, isWritable: false },
              { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,      isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId,          isSigner: false, isWritable: false },
            ],
            data,
          }));
        }

        const [signed] = await wallet.signTransactions({ transactions: [tx] });
        const sig = await connection.sendRawTransaction(signed.serialize());
        await confirmWithTimeout(sig, blockhash, lastValidBlockHeight);
        toast.success(
          `Respaldo enviado — ${amount} ${currency} a Robot ${side === 0 ? "A" : "B"}`,
          sig.slice(0, 16) + "…",
        );
      });
    } catch (e: unknown) {
      toast.error("Respaldo fallido", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.panel}>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerDot} />
        <Text style={styles.title}>RESPALDA A TU FAVORITO</Text>
        <View style={styles.headerDot} />
      </View>

      {/* Currency toggle */}
      <View style={styles.currencyRow}>
        <TouchableOpacity
          style={[styles.currencyBtn, currency === "SOL" && styles.currencyBtnActive]}
          onPress={() => setCurrency("SOL")}
        >
          <Text style={[styles.currencyBtnText, currency === "SOL" && styles.currencyBtnTextActive]}>SOL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.currencyBtn, currency === "USDC" && styles.currencyBtnActive]}
          onPress={() => setCurrency("USDC")}
        >
          <Text style={[styles.currencyBtnText, currency === "USDC" && styles.currencyBtnTextActive]}>USDC</Text>
        </TouchableOpacity>
      </View>

      {/* Pool bar — always visible so spectators see the odds before connecting */}
      <View style={styles.poolSection}>
        <View style={styles.poolLabels}>
          <Text style={[styles.poolSide, { color: C.robotA }]} numberOfLines={1}>{nameA}  {oddsA}%</Text>
          <Text style={[styles.poolTotal, { color: C.teal }]}>
            {(totalPool / unitDivisor).toFixed(3)} {currency}
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
          <Text style={styles.connectHint}>Conectá tu wallet para respaldar al ganador</Text>
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

          {/* Amount input */}
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={C.textDim}
              keyboardType="decimal-pad"
            />
            <Text style={styles.amountSuffix}>{currency}</Text>
          </View>

          {/* Payout estimate */}
          {side !== null && totalPool > 0 && hasValidAmount && (
            <Text style={styles.estimate}>
              Retorno estimado si gana Robot {side === 0 ? "A" : "B"}:{" "}
              <Text style={{ color: C.green }}>
                {((amountValue * totalPool * 0.95) /
                  (side === 0 ? poolA : poolB) /
                  unitDivisor).toFixed(3)} {currency}
              </Text>
            </Text>
          )}

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.backBtn, (side === null || !hasValidAmount) && styles.backBtnDisabled]}
            onPress={placeBack}
            disabled={loading || side === null || !hasValidAmount}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.backBtnText}>
                {side === null
                  ? "ELEGÍ UN ROBOT"
                  : !hasValidAmount
                  ? "INGRESÁ UN MONTO"
                  : `RESPALDAR ${amount} ${currency} A ${side === 0 ? nameA : nameB} →`}
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

  // Currency toggle
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyBtn: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingVertical: 8, alignItems: "center", backgroundColor: C.bgAccent,
  },
  currencyBtnActive: { borderColor: C.purple, backgroundColor: C.purple + "22" },
  currencyBtnText: { fontFamily: MONO, color: C.textDim, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  currencyBtnTextActive: { color: C.purple },

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
    color: "#fff", fontFamily: SANS_900,
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
    color: C.textPrimary, fontFamily: SANS_900,
    fontSize: 13, letterSpacing: 1,
  },
  sideOdds: { color: C.textDim, fontFamily: MONO, fontSize: 10 },
  vsSmall:  { paddingHorizontal: 2 },
  vsText:   { color: C.textDim, fontSize: 11, fontFamily: SANS_700 },

  // Amount
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountInput: {
    flex: 1, backgroundColor: C.bgAccent, borderRadius: 8,
    borderWidth: 1, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 12,
    color: C.textPrimary, fontFamily: MONO, fontSize: 13,
  },
  amountSuffix: { fontFamily: MONO, color: C.textDim, fontSize: 11 },

  // Estimate
  estimate: {
    fontFamily: MONO, color: C.textDim,
    fontSize: 10, textAlign: "center",
  },

  // Back button
  backBtn: {
    backgroundColor: C.purple, borderRadius: 10,
    padding: 16, alignItems: "center",
    shadowColor: C.purple, shadowOpacity: 0.45,
    shadowRadius: 12, elevation: 6,
  },
  backBtnDisabled: {
    backgroundColor: C.bgAccent, shadowOpacity: 0, elevation: 0,
  },
  backBtnText: {
    color: "#fff", fontFamily: SANS_900,
    fontSize: 13, letterSpacing: 2,
  },
});
