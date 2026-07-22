// Web stub — MWA is native-only. Metro loads useWallet.native.ts on Android.
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { PublicKey } from "@solana/web3.js";

export function useWallet() {
  const [publicKey] = useState<PublicKey | null>(null);
  const [connecting] = useState(false);
  const isWebPreview = true as const;

  const connect = useCallback(async () => {
    Alert.alert(
      "Android required",
      "Open this app on an Android device to connect your wallet.",
      [{ text: "OK" }]
    );
  }, []);

  const disconnect = useCallback(() => {}, []);

  const authorizeSession = useCallback(async (_wallet: any): Promise<PublicKey> => {
    throw new Error("MWA is native-only — open this app on an Android device.");
  }, []);

  return { publicKey, connect, disconnect, connecting, isWebPreview, authorizeSession };
}
