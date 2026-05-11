"use client";
import React, { useState } from "react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ConnectButton from "./ConnectButton";
import MobileSearch from "./MobileSearch";
import { Search } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { collapsed } = useSidebar();

  return (
    <header
      className={`fixed top-0 right-0 z-40 h-16 bg-[#09090B]/80 backdrop-blur-md border-b border-white/[0.05] flex items-center px-4 md:px-6 gap-3 transition-all duration-300 left-0 ${
        collapsed ? "md:left-[60px]" : "md:left-[220px]"
      }`}
    >
      {/* Mobile: search icon (left) */}
      <button
        onClick={() => setSearchOpen(true)}
        className="md:hidden flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-white/50 hover:text-white transition-colors"
      >
        <Search size={20} />
      </button>

      {/* Mobile: logo (center) | Desktop: search bar (left) */}
      <div className="flex-1 flex items-center justify-center md:justify-start">
        <div className="md:hidden">
          <Logo />
        </div>
        <div className="hidden md:block w-full max-w-sm">
          <SearchBar />
        </div>
      </div>

      {/* Wallet — both mobile and desktop */}
      <ConnectButton />

      <MobileSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
