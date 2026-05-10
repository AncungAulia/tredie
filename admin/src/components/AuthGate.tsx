"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet, ShieldOff } from "lucide-react";
import { useState, useEffect } from "react";

const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { publicKey, connecting, select, wallets } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || connecting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#9C93E8] rounded-full animate-spin" />
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(156,147,232,0.08)] border border-[rgba(156,147,232,0.15)] flex items-center justify-center">
            <Wallet size={24} className="text-[#9C93E8]" />
          </div>
          <h2 className="text-xl font-semibold text-white">Connect Wallet</h2>
          <p className="text-white/40 text-sm max-w-xs">
            Connect your Solana wallet to access the admin panel.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-52">
          {wallets.map((w) => (
            <button
              key={w.adapter.name}
              onClick={() => select(w.adapter.name)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-[rgba(156,147,232,0.08)] hover:border-[rgba(156,147,232,0.20)] text-white/70 hover:text-white font-medium text-sm transition-colors"
            >
              {w.adapter.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.adapter.icon} alt={w.adapter.name} className="w-5 h-5 rounded" />
              )}
              {w.adapter.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const key = publicKey.toBase58();
  if (ADMIN_WALLETS.length > 0 && !ADMIN_WALLETS.includes(key)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] flex items-center justify-center">
          <ShieldOff size={24} className="text-[#EF4444]" />
        </div>
        <h2 className="text-xl font-semibold text-white">Access Denied</h2>
        <p className="text-white/40 text-sm max-w-xs">
          Wallet <span className="font-mono text-white/60">{key.slice(0, 8)}…{key.slice(-6)}</span> is not in the admin allowlist.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
