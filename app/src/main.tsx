import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

const RPC = import.meta.env.VITE_SOLANA_RPC ?? "https://api.devnet.solana.com";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ce = (type: any, props: any, ...children: any[]) =>
  React.createElement(type, props, ...children);

function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return ce(
    ConnectionProvider,
    { endpoint: RPC },
    ce(WalletProvider, { wallets, autoConnect: true },
      ce(WalletModalProvider, {}, children)
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
);
