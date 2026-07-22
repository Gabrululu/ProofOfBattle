import { Buffer } from "buffer";
// @coral-xyz/anchor's account resolver (and other Solana libs) call the bare
// `Buffer` global assuming a Node-like environment. Vite doesn't polyfill
// Node globals for the browser, so without this, every `Buffer.from(...)`
// inside Anchor throws ReferenceError — silently swallowed by its own
// try/catch — leaving PDAs unresolved forever ("Reached maximum depth for
// account resolution"). Must run before any other module touches Buffer.
globalThis.Buffer = globalThis.Buffer ?? Buffer;

import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { MarketingLanding } from "./views/MarketingLanding";
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MarketingLanding />} />
          <Route path="/app/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  </React.StrictMode>
);
