"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet, LogOut } from "lucide-react";
import Link from "next/link";

export default function Header() {
  const { publicKey, disconnect, connecting } = useWallet();

  const key = publicKey?.toBase58();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#09090B]/90 backdrop-blur-md border-b border-white/[0.06] flex items-center px-6 gap-4">
      <Link href="/candidates" className="flex items-center gap-2.5 shrink-0">
        <span className="text-white font-bold text-base tracking-tight">tredie</span>
        <span className="text-[10px] font-mono font-bold text-[#9C93E8] bg-[rgba(156,147,232,0.12)] border border-[rgba(156,147,232,0.25)] px-1.5 py-0.5 rounded">
          admin
        </span>
      </Link>

      <div className="flex-1" />

      {connecting ? (
        <div className="w-5 h-5 border-2 border-white/20 border-t-[#9C93E8] rounded-full animate-spin" />
      ) : key ? (
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs font-mono hidden sm:block">
            {key.slice(0, 6)}…{key.slice(-4)}
          </span>
          <button
            onClick={() => disconnect()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 transition-colors text-xs"
          >
            <LogOut size={12} />
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-white/30 text-xs">
          <Wallet size={13} />
          Not connected
        </div>
      )}
    </header>
  );
}
