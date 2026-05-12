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
      {/* Left section: Mobile search button / Desktop spacer */}
      <div className="flex-1 flex items-center">
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-white/50 hover:text-white transition-colors"
        >
          <Search size={20} />
        </button>
      </div>

      {/* Center section: Mobile logo / Desktop search bar */}
      <div className="flex-[2] md:flex-1 flex items-center justify-center">
        <div className="md:hidden">
          <Logo />
        </div>
        <div className="hidden md:block w-full max-w-2xl">
          <SearchBar />
        </div>
      </div>

      {/* Right section: Wallet button */}
      <div className="flex-1 flex items-center justify-end">
        <ConnectButton />
      </div>

      <MobileSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
