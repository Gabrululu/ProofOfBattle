import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import {
  PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, TransactionInstruction,
} from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  connection, getBattlePDA, getVaultPDA, getBetPDA,
  fetchBetState, CLAIM_WINNINGS_DISCRIMINATOR,
} from "../lib/program";
import { PROGRAM_ID } from "../lib/constants";
import { C, MONO, SANS_900 } from "../lib/theme";

interface Props {
  battleId:  number;
  publicKey: PublicKey;
  winner:    number;   // 0 | 1
}

export function ClaimPanel({ battleId, publicKey, winner }: Props) {
  const [bet, setBet]         = useState<{ side: number; amount: number; claimed: boolean } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setFetching(true);
    fetchBetState(battleId, publicKey)
      .then(setBet)
      .catch(() => setBet(null))
      .finally(() => setFetching(false));
  }, [battleId, publicKey]);

  if (fetching) {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={C.purple} />
      </View>
    );
  }

  // No bet or bet on the losing side — nothing to claim
  if (!bet || bet.side !== winner) return null;

  if (bet.claimed) {
    return (
      <View style={styles.claimedRow}>
        <Text style={styles.claimedTxt}>{">"} WINNINGS CLAIMED</Text>
      </View>
    );
  }

  const claim = async () => {
    setLoading(true);
    try {
      const battleIdBuf = Buffer.alloc(8);
      battleIdBuf.writeBigUInt64LE(BigInt(battleId));
      const data = Buffer.concat([CLAIM_WINNINGS_DISCRIMINATOR, battleIdBuf]);

      const [battlePDA] = getBattlePDA(battleId);
      const [betPDA]    = getBetPDA(battleId, publicKey);
      const [vaultPDA]  = getVaultPDA(battleId);

      await transact(async (wallet: any) => {
        const { blockhash } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });
        tx.add(new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: battlePDA,               isSigner: false, isWritable: false },
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
        setBet((prev) => prev ? { ...prev, claimed: true } : prev);
        Alert.alert(
          "Claimed!",
          `${(bet.amount / LAMPORTS_PER_SOL).toFixed(3)} SOL received\n${sig.slice(0, 16)}…`
        );
      });
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>CLAIM WINNINGS</Text>
      <Text style={styles.detail}>
        {">"} YOUR BET: {(bet.amount / LAMPORTS_PER_SOL).toFixed(3)} SOL · ROBOT {winner === 0 ? "A" : "B"}
      </Text>
      <TouchableOpacity style={styles.btn} onPress={claim} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.btnText}>CLAIM WINNINGS</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    paddingVertical: 12,
  },

  claimedRow: {
    alignItems: "center",
    paddingVertical: 10,
  },
  claimedTxt: {
    fontFamily: MONO,
    color:      C.green,
    fontSize:   11,
    letterSpacing: 2,
  },

  panel: {
    backgroundColor: C.bgCard,
    borderRadius:    14,
    padding:         18,
    borderWidth:     1,
    borderColor:     C.green,
    gap:             12,
  },
  title: {
    fontFamily: MONO,
    color:      C.green,
    fontSize:   12,
    fontWeight: "900",
    letterSpacing: 3,
    textAlign:  "center",
  },
  detail: {
    fontFamily: MONO,
    color:      C.textSecondary,
    fontSize:   11,
    textAlign:  "center",
    letterSpacing: 0.5,
  },
  btn: {
    backgroundColor: C.green,
    borderRadius:    10,
    padding:         15,
    alignItems:      "center",
    shadowColor:     C.green,
    shadowOpacity:   0.4,
    shadowRadius:    10,
    elevation:       6,
  },
  btnText: {
    color:      "#000",
    fontFamily: SANS_900,
    fontSize:   13,
    letterSpacing: 1,
  },
});
