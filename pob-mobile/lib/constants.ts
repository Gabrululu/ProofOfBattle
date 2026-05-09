import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// Deployed program ID — devnet
export const PROGRAM_ID = new PublicKey(
  "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"
);

export const RPC_ENDPOINT = clusterApiUrl("devnet");

// Bridge — GitHub Codespace public URL
export const BRIDGE_BASE_URL = "https://stunning-space-disco-xqqp4wqp55gc9qv9-8000.app.github.dev";
export const BRIDGE_WS_BASE = "wss://stunning-space-disco-xqqp4wqp55gc9qv9-8000.app.github.dev";
