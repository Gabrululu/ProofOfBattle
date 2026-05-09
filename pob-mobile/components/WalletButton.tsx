import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
import { PublicKey } from "@solana/web3.js";
import { C } from "../lib/theme";

export interface WalletButtonProps {
  publicKey: PublicKey | null;
  connecting: boolean;
  isWebPreview?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletButton({
  publicKey,
  connecting,
  isWebPreview = false,
  onConnect,
  onDisconnect,
}: WalletButtonProps) {
  if (publicKey) {
    const addr = publicKey.toString();
    const short = `${addr.slice(0, 4)}···${addr.slice(-4)}`;
    return (
      <TouchableOpacity style={styles.connected} onPress={onDisconnect}>
        <View style={[styles.dot, { backgroundColor: C.green }]} />
        <Text style={styles.connectedText}>{short}</Text>
      </TouchableOpacity>
    );
  }

  if (isWebPreview) {
    return (
      <View style={styles.webHintBox}>
        <Text style={styles.webHintText}>Open on Android to connect wallet</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.connect} onPress={onConnect} disabled={connecting}>
      {connecting ? (
        <ActivityIndicator color="#000" size="small" />
      ) : (
        <Text style={styles.connectText}>CONNECT WALLET</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  connect: {
    backgroundColor: C.purple,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    shadowColor: C.purple,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  connectText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2,
  },
  connected: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
    backgroundColor: C.bgCard,
    borderRadius:   8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth:    1,
    borderColor:    C.green,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectedText: {
    color:      C.green,
    fontWeight: "700",
    fontSize:   13,
    letterSpacing: 1,
  },
  webHintBox: {
    borderWidth:  1,
    borderColor:  C.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  webHintText: {
    color:    C.textDim,
    fontSize: 12,
    fontStyle: "italic",
  },
});
