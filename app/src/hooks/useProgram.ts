import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import idl from "../idl/proof_of_battle.json";

export const PROGRAM_ID = "9MFZtJWMutu1E6VDvKSJiDFEncidaoYvrsffr7U1MxCP";

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    return new Program(idl as unknown as Idl, provider);
  }, [connection, wallet]);
}
