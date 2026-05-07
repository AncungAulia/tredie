"use client";
import React from "react";
import { Search } from "lucide-react";

export default function SearchBar() {
  return (
    <div className="relative w-full max-w-lg">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-white/40" />
      </div>
      <input
        type="text"
        placeholder="Search ticker, contract, or paste a link..."
        className="block w-full pl-10 pr-3 py-2 border border-white/[0.07] rounded-full leading-5 bg-white/[0.04] text-sm placeholder-white/40 text-white focus:outline-none focus:bg-white/[0.06] focus:border-[rgba(156,147,232,0.30)] transition-colors"
      />
    </div>
  );
}
