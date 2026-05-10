"use client";
import React, { useState } from "react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ConnectButton from "./ConnectButton";
import MobileSearch from "./MobileSearch";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

const navLinks = [
  { href: "/topics", label: "Topics" },
  { href: "/tokens", label: "Tokens" },
  { href: "/portfolio", label: "Portfolio" },
];

export default function Header() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const activeIndex = navLinks.findIndex(
    (l) => pathname === l.href || pathname.startsWith(l.href + "/")
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#09090B]/80 backdrop-blur-md border-b border-white/[0.05] flex items-center px-4 md:px-12 gap-8">
      <Logo />

      {/* Nav tabs with sliding pill */}
      <nav className="relative hidden md:flex ml-4 p-1 bg-white/[0.04] rounded-full border border-white/[0.07]">
        {/* Sliding pill — width = 1/3 of inner area, translateX(100%) = tepat satu tab */}
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-full bg-[rgba(156,147,232,0.15)] border border-[rgba(156,147,232,0.30)] transition-transform duration-300 ease-out will-change-transform pointer-events-none"
          style={{
            left: "0.25rem",
            width: "calc((100% - 0.5rem) / 3)",
            transform: `translateX(${(activeIndex >= 0 ? activeIndex : 0) * 100}%)`,
            opacity: activeIndex >= 0 ? 1 : 0,
          }}
        />
        {navLinks.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={`relative z-10 w-24 text-center py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
              activeIndex === i
                ? "text-[#9C93E8]"
                : "text-white/50 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Search bar */}
      <div className="flex-1 max-w-xl mx-auto hidden md:block">
        <SearchBar />
      </div>

      {/* Right side: search icon (mobile) + Connect Wallet */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Search size={18} />
        </button>
        <ConnectButton />
      </div>

      <MobileSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
