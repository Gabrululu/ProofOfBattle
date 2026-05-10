import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { PublicKey } from "@solana/web3.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const STORAGE_KEY = "@pob_wallet_pubkey";

interface WalletCtx {
  publicKey: PublicKey | null;
  connecting: boolean;
  isWebPreview: false;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletCtx>({
  publicKey: null,
  connecting: false,
  isWebPreview: false,
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Restore session on app start
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setPublicKey(new PublicKey(raw));
        } catch {
          AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    });
  }, []);

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
        const pk = new PublicKey(result.accounts[0].address);
        setPublicKey(pk);
        await AsyncStorage.setItem(STORAGE_KEY, pk.toBase58());
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const noWallet =
        msg.toLowerCase().includes("no installed wallet") ||
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

  const disconnect = useCallback(() => {
    setPublicKey(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <WalletContext.Provider
      value={{ publicKey, connecting, isWebPreview: false, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}
