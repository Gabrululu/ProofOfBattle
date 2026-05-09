import { PublicKey, clusterApiUrl } from "@solana/web3.js";

// Deployed program ID — from on-chain/target/types/proof_of_battle.ts
export const PROGRAM_ID = new PublicKey(
  "7xStH3SCRkztTc1SWQtcx9ACvwqaYyUJF35dTbpAZG2S"
);

export const RPC_ENDPOINT = clusterApiUrl("devnet");

// Replace with your local machine's IP when running bridge locally
// Bridge FastAPI runs on port 8000
export const BRIDGE_BASE_URL = "http://192.168.1.100:8000";
export const BRIDGE_WS_BASE = "ws://192.168.1.100:8000";
