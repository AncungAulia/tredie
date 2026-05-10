"use client";
import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

function truncate(str: string, front = 4, back = 4) {
  if (str.length <= front + back + 3) return str;
  return `${str.slice(0, front)}...${str.slice(-back)}`;
}

export default function ConnectButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const { ready, authenticated, logout, user } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();

  useEffect(() => { setMounted(true); }, []);

  function handleMouseMove(e: React.MouseEvent) {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    gsap.to(buttonRef.current, {
      duration: 0.4,
      rotationX: -((e.clientY - rect.top - rect.height / 2) / (rect.height / 2)) * 12,
      rotationY: ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 12,
      transformPerspective: 600,
      ease: "power2.out",
      overwrite: "auto",
    });
  }

  function handleMouseLeave() {
    if (!buttonRef.current) return;
    gsap.to(buttonRef.current, {
      duration: 0.5,
      rotationX: 0,
      rotationY: 0,
      ease: "power2.out",
      overwrite: "auto",
    });
  }

  function handleClick() {
    if (!ready) return;
    if (authenticated) {
      logout();
    } else {
      login();
    }
  }

  // Derive display label
  let label = "Connect Wallet";
  if (!mounted || !ready) {
    label = "Connect Wallet";
  } else if (authenticated) {
    const activeAddress = wallets[0]?.address;
    const linkedSolanaAddress = (user?.linkedAccounts as any[])
      ?.find(a => a.type === "wallet" && a.chainType === "solana")
      ?.address as string | undefined;
    const solanaAddress = activeAddress ?? linkedSolanaAddress;

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

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      disabled={!ready}
      className={`group h-9 overflow-hidden cursor-pointer rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        isConnected
          ? "bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12]"
          : "bg-[#9C93E8] hover:bg-[#B3ABF0]"
      }`}
    >
      <div className="flex flex-col group-hover:-translate-y-1/2 transition-transform duration-300 ease-out">
        <span className={`block px-5 py-2.5 text-xs font-semibold uppercase leading-4 ${isConnected ? "text-white" : "text-black"}`}>
          {label}
        </span>
        <span className={`block px-5 py-2.5 text-xs font-semibold uppercase leading-4 ${isConnected ? "text-white" : "text-black"}`} aria-hidden="true">
          {label}
        </span>
      </div>
    </button>
  );
}
