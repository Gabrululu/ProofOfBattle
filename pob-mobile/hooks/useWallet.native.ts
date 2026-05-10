import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { PublicKey } from "@solana/web3.js";
// In Expo Go this resolves to stubs/mwa.js (no TurboModule).
// In a dev build (npx expo run:android), remove the metro.config.js override
// to use the real @solana-mobile package.
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

export function useWallet() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  const isWebPreview = false;

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await transact(async (wallet: any) => {
        const result = await wallet.authorize({
          cluster: "devnet",
          identity: {
            name: "Proof of Battle",
            uri: "https://proofofbattle.xyz",
            icon: "/icon.png",
          },
        });
        setPublicKey(new PublicKey(result.accounts[0].address));
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const noWallet = msg.toLowerCase().includes("no installed wallet") ||
                       msg.toLowerCase().includes("no wallet");
      Alert.alert(
        noWallet ? "No wallet found" : "Wallet error",
        noWallet
          ? "Install Phantom or Solflare from Google Play, then try again."
          : msg
      );
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setPublicKey(null), []);

  return { publicKey, connect, disconnect, connecting, isWebPreview };
}
