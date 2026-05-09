// Web stub — MWA is native-only. Metro loads useWallet.native.ts on Android/iOS.
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { PublicKey } from "@solana/web3.js";

export function useWallet() {
  const [publicKey] = useState<PublicKey | null>(null);
  const [connecting] = useState(false);
  const isWebPreview = true;

  const connect = useCallback(() => {
    Alert.alert(
      "Android required",
      "Open this app in Expo Go on an Android device to connect your wallet.",
      [{ text: "OK" }]
    );
  }, []);

  const disconnect = useCallback(() => {}, []);

  return { publicKey, connect, disconnect, connecting, isWebPreview };
}
