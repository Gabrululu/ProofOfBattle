import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from "react-native";
import {
  PublicKey, Transaction, SystemProgram,
  LAMPORTS_PER_SOL, TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  connection, getBattlePDA, getVaultPDA, getBetPDA,
  fetchBetState, fetchBetTokenState, CLAIM_WINNINGS_DISCRIMINATOR, confirmWithTimeout,
  getBetTokenPDA, getVaultAuthorityPDA, getVaultTokenPDA, serializeClaimWinningsToken,
} from "../lib/program";
import { PROGRAM_ID, USDC_MINT, USDC_DECIMALS } from "../lib/constants";
import { C, MONO, SANS_900 } from "../lib/theme";
import { useWallet } from "../hooks/useWallet";

interface Props {
  battleId:  number;
  publicKey: PublicKey;
  winner:    number;   // 0 | 1
}

type BetInfo = { side: number; amount: number; claimed: boolean; currency: "SOL" | "USDC" };

export function ClaimPanel({ battleId, publicKey, winner }: Props) {
  const { authorizeSession } = useWallet();
  const [bet, setBet]         = useState<BetInfo | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setFetching(true);
    // A SOL `Bet` and a USDC `BetToken` are separate accounts — check both,
    // only one (if any) will exist for this wallet on this battle.
    Promise.all([
      fetchBetState(battleId, publicKey),
      fetchBetTokenState(battleId, USDC_MINT, publicKey),
    ])
      .then(([solBet, usdcBet]) => {
        if (solBet) setBet({ ...solBet, currency: "SOL" });
        else if (usdcBet) setBet({ ...usdcBet, currency: "USDC" });
        else setBet(null);
      })
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
      const [battlePDA] = getBattlePDA(battleId);

      await transact(async (wallet: any) => {
        await authorizeSession(wallet);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        const tx = new Transaction({ recentBlockhash: blockhash, feePayer: publicKey });

        if (bet.currency === "SOL") {
          const [betPDA]   = getBetPDA(battleId, publicKey);
          const [vaultPDA] = getVaultPDA(battleId);
          const battleIdBuf = Buffer.alloc(8);
          battleIdBuf.writeBigUInt64LE(BigInt(battleId));
          const data = Buffer.concat([CLAIM_WINNINGS_DISCRIMINATOR, battleIdBuf]);
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
        } else {
          const [betTokenPDA]  = getBetTokenPDA(battleId, USDC_MINT, publicKey);
          const [vaultAuthPDA] = getVaultAuthorityPDA(battleId, USDC_MINT);
          const [vaultTokenPDA] = getVaultTokenPDA(battleId, USDC_MINT);
          const bettorAta = await getAssociatedTokenAddress(USDC_MINT, publicKey);
          const data = serializeClaimWinningsToken(battleId);
          tx.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
              { pubkey: battlePDA,          isSigner: false, isWritable: false },
              { pubkey: betTokenPDA,        isSigner: false, isWritable: true  },
              { pubkey: vaultAuthPDA,       isSigner: false, isWritable: false },
              { pubkey: vaultTokenPDA,      isSigner: false, isWritable: true  },
              { pubkey: USDC_MINT,          isSigner: false, isWritable: false },
              { pubkey: bettorAta,          isSigner: false, isWritable: true  },
              { pubkey: publicKey,          isSigner: true,  isWritable: true  },
              { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
            ],
            data,
          }));
        }

        const [signed] = await wallet.signTransactions({ transactions: [tx] });
        const sig = await connection.sendRawTransaction(signed.serialize());
        await confirmWithTimeout(sig, blockhash, lastValidBlockHeight);
        setBet((prev) => prev ? { ...prev, claimed: true } : prev);
        const divisor = bet.currency === "SOL" ? LAMPORTS_PER_SOL : 10 ** USDC_DECIMALS;
        Alert.alert(
          "Claimed!",
          `${(bet.amount / divisor).toFixed(3)} ${bet.currency} received\n${sig.slice(0, 16)}…`
        );
      });
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const divisor = bet.currency === "SOL" ? LAMPORTS_PER_SOL : 10 ** USDC_DECIMALS;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>CLAIM WINNINGS</Text>
      <Text style={styles.detail}>
        {">"} TU RESPALDO: {(bet.amount / divisor).toFixed(3)} {bet.currency} · ROBOT {winner === 0 ? "A" : "B"}
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
