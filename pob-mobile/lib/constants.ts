import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"
);

// Circle's official devnet USDC mint (6 decimals). The on-chain program
// accepts any mint for place_bet_token/claim_winnings_token — this is a
// frontend-level choice, not an on-chain restriction.
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
export const USDC_DECIMALS = 6;

// EXPO_PUBLIC_ prefix makes these available at build time in Expo.
// Set them in .env (local) or in EAS secrets / eas.json (build).
// The public devnet RPC is heavily rate-limited and its confirmTransaction
// polling is unreliable under any load — set EXPO_PUBLIC_SOLANA_RPC to a
// dedicated provider (Helius, QuickNode, etc.) to avoid transactions hanging.
export const RPC_ENDPOINT =
  process.env.EXPO_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");

const BRIDGE_HOST =
  process.env.EXPO_PUBLIC_BRIDGE_URL ?? "https://your-bridge.up.railway.app";

export const BRIDGE_BASE_URL = BRIDGE_HOST;
export const BRIDGE_WS_BASE  = BRIDGE_HOST.replace(/^https?/, (p) =>
  p === "https" ? "wss" : "ws"
);

// MWA scopes auth_token to the identity it was issued for — every
// authorize()/reauthorize() call across the app must use this same object.
export const APP_IDENTITY = {
  name: "Proof of Battle",
  uri: "https://proofofbattle.xyz",
  icon: "/icon.png",
};
