"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { gsap } from "gsap";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { Copy, Check, LogOut, Wallet } from "lucide-react";

function truncate(str: string, front = 4, back = 4) {
  if (str.length <= front + back + 3) return str;
  return `${str.slice(0, front)}...${str.slice(-back)}`;
}

const isTouchDevice = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

export default function ConnectButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { ready, authenticated, logout, user } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();

  useEffect(() => { setMounted(true); }, []);

  // Close on outside click AND outside touch
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Animate dropdown open/close
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    if (open) {
      gsap.fromTo(
        el,
        { opacity: 0, y: -6, pointerEvents: "none" },
        { opacity: 1, y: 0, pointerEvents: "auto", duration: 0.18, ease: "power2.out" }
      );
    } else {
      gsap.to(el, { opacity: 0, y: -6, pointerEvents: "none", duration: 0.13, ease: "power2.in" });
    }
  }, [open]);

  // 3D tilt — desktop only
  function handleMouseMove(e: React.MouseEvent) {
    if (isTouchDevice() || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    gsap.to(buttonRef.current, {
      duration: 0.4,
      rotationX: -((e.clientY - rect.top - rect.height / 2) / (rect.height / 2)) * 10,
      rotationY: ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 10,
      transformPerspective: 600,
      ease: "power2.out",
      overwrite: "auto",
    });
  }

  function handleMouseLeave() {
    if (isTouchDevice() || !buttonRef.current) return;
    gsap.to(buttonRef.current, {
      duration: 0.5,
      rotationX: 0,
      rotationY: 0,
      ease: "power2.out",
      overwrite: "auto",
    });
  }

  // Resolve active Solana address
  const activeAddress =
    wallets.find((w) => (w as any).walletClientType !== "privy")?.address ??
    wallets[0]?.address;
  const linkedSolanaAddress = (user?.linkedAccounts as any[])
    ?.find((a) => a.type === "wallet" && a.chainType === "solana")
    ?.address as string | undefined;
  const solanaAddress = activeAddress ?? linkedSolanaAddress;

  const handleCopy = useCallback(() => {
    if (!solanaAddress) return;
    navigator.clipboard.writeText(solanaAddress);
    setCopied(true);

    // GSAP Pop/Tilt effect
    if (copyButtonRef.current) {
      gsap.fromTo(
        copyButtonRef.current,
        { rotationX: 0, scale: 1 },
        {
          rotationX: -15,
          scale: 0.98,
          duration: 0.1,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        }
      );
    }

    setTimeout(() => setCopied(false), 1500);
  }, [solanaAddress]);

  const handleDisconnect = useCallback(() => {
    setOpen(false);
    logout();
  }, [logout]);

  // Button label
  let label = "Connect Wallet";
  if (mounted && ready && authenticated) {
    if (solanaAddress) {
      label = truncate(solanaAddress);
    } else if (user?.email?.address) {
      const email = user.email.address;
      label = email.length > 18 ? email.slice(0, 14) + "..." : email;
    } else {
      label = "Connected";
    }
  }

  const isConnected = mounted && ready && authenticated;

  if (!isConnected) {
    return (
      <button
        ref={buttonRef}
        onClick={() => ready && login()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        disabled={!ready}
        className="group h-9 overflow-hidden cursor-pointer rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#9C93E8] hover:bg-[#B3ABF0] outline-none focus:outline-none"
      >
        <div className="flex flex-col group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
          <span className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase leading-4 text-black">
            <Wallet size={13} />
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </span>
          <span className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase leading-4 text-black" aria-hidden="true">
            <Wallet size={13} />
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </span>
        </div>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Main button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group h-9 overflow-hidden cursor-pointer rounded-md transition-colors bg-white/[0.08] hover:bg-white/[0.13] border border-white/[0.12] outline-none focus:outline-none"
      >
        <div className="flex flex-col group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
          <span className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono leading-4 text-white">
            <Wallet size={13} className="text-[#9C93E8] shrink-0" />
            {label}
          </span>
          <span className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold font-mono leading-4 text-white" aria-hidden="true">
            <Wallet size={13} className="text-[#9C93E8] shrink-0" />
            {label}
          </span>
        </div>
      </button>

      {/* Dropdown — right-aligned, constrained agar tidak keluar layar di mobile */}
      <div
        ref={dropdownRef}
        style={{
          opacity: 0,
          pointerEvents: "none",
          background: "rgba(14,14,18,0.97)",
          backdropFilter: "blur(12px)",
        }}
        className="absolute right-0 top-full mt-2 rounded-xl border border-white/[0.10] shadow-2xl z-50 overflow-hidden
                   w-full min-w-[180px]"
      >
        {/* Address row */}
        {solanaAddress && (
          <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.07]">
            <p className="text-white/30 text-[10px] uppercase tracking-wide mb-1.5">Wallet</p>
            <p className="text-white font-mono text-xs leading-relaxed break-all">
              {solanaAddress.slice(0, 8)}...{solanaAddress.slice(-8)}
            </p>
          </div>
        )}

        {/* Copy */}
        <button
          ref={copyButtonRef}
          onClick={handleCopy}
          className="w-full relative h-[46px] overflow-hidden cursor-pointer hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors text-left"
        >
          <div className={`flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${copied ? "-translate-y-1/2" : ""}`}>
            {/* Default state */}
            <div className="flex items-center gap-3 px-4 py-3.5 text-white/75">
              <Copy size={15} className="text-white/40 shrink-0" />
              <span className="text-xs font-bold">Copy address</span>
            </div>
            {/* Copied state */}
            <div className="flex items-center gap-3 px-4 py-3.5 text-[#22C55E]">
              <Check size={15} className="shrink-0" />
              <span className="text-xs font-bold">Copied!</span>
            </div>
          </div>
        </button>

        {/* Disconnect */}
        <button
          onClick={handleDisconnect}
          className="w-full cursor-pointer   flex items-center gap-3 px-4 py-3.5 text-[#EF4444]/75 hover:text-[#EF4444] active:text-[#EF4444] hover:bg-[#EF4444]/[0.06] active:bg-[#EF4444]/[0.08] transition-colors text-left border-t border-white/[0.07]"
        >
          <LogOut size={15} className="shrink-0" />
          <span className="text-xs font-bold">Disconnect</span>
        </button>
      </div>
    </div>
  );
}
