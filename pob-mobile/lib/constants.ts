import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// Deployed program ID — devnet
export const PROGRAM_ID = new PublicKey(
  "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP"
);

export const RPC_ENDPOINT = clusterApiUrl("devnet");

// Replace with your local machine's IP when running bridge locally
// Bridge FastAPI runs on port 8000
export const BRIDGE_BASE_URL = "http://192.168.1.100:8000";
export const BRIDGE_WS_BASE = "ws://192.168.1.100:8000";
