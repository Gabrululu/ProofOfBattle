import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"
);

export const RPC_ENDPOINT = clusterApiUrl("devnet");

// EXPO_PUBLIC_ prefix makes these available at build time in Expo.
// Set them in .env (local) or in EAS secrets / eas.json (build).
const BRIDGE_HOST =
  process.env.EXPO_PUBLIC_BRIDGE_URL ?? "https://your-bridge.up.railway.app";

export const BRIDGE_BASE_URL = BRIDGE_HOST;
export const BRIDGE_WS_BASE  = BRIDGE_HOST.replace(/^https?/, (p) =>
  p === "https" ? "wss" : "ws"
);
