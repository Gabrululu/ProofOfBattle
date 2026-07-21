import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <button
        onClick={disconnect}
        title="Click to disconnect"
        className="text-[9px] font-mono px-2 py-1 rounded border border-green-800 text-green-400 bg-green-950/30 hover:border-red-800 hover:text-red-400 hover:bg-red-950/30 transition-colors tracking-wider"
      >
        {addr.slice(0, 4)}…{addr.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="text-[9px] font-mono px-2 py-1 rounded border border-primary text-primary bg-primary/30 hover:bg-primary/40 transition-colors tracking-wider"
    >
      CONNECT
    </button>
  );
}
