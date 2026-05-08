"use client";
import React from "react";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ConnectButton from "./ConnectButton";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/trends", label: "Trends" },
    { href: "/tokens", label: "Tokens" },
    { href: "/portfolio", label: "Portfolio" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#09090B]/80 backdrop-blur-md border-b border-white/[0.05] flex items-center px-8 lg:px-12 gap-8">
      <Logo />

      {/* Nav links */}
      <nav className="hidden md:flex items-center gap-1 ml-4">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))
                ? "bg-[rgba(156,147,232,0.12)] text-[#9C93E8]"
                : "text-white/50 hover:text-white hover:bg-white/[0.04]"
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

      {/* Right side: Connect Wallet */}
      <div className="flex items-center gap-4 shrink-0 ml-auto">
        <ConnectButton />
      </div>
    </header>
  );
}
