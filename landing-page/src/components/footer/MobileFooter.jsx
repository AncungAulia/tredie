import React from "react";

import Image from "next/image";
export default function MobileFooter() {
  return (
    <footer className="bg-neutral-900 text-white px-6 py-12">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start mb-6">
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Trade the
              <br />
              Attention Economy
            </h2>
            <div className="space-y-1 text-sm">
              <p>Tredie Fun</p>
              <p>Solana Devnet</p>
              <p>Colosseum Frontier 2026</p>
              <p className="mt-4">solana.frontier@tredie.xyz</p>
            </div>
          </div>
        </div>
      </div>

      {/* Explore Section */}
      <div className="mb-12 flex justify-start gap-15">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4">
          EXPLORE
        </h3>
        <nav className="space-y-0 font-display ">
          <a href="#" className="block text-[6vw] ">
            Home
          </a>
          <a href="#" className="block text-[6vw] ">
            About
          </a>
          <a href="#" className="block text-[6vw] ">
            Markets
          </a>
          <a href="#" className="block text-[6vw] ">
            How It Works
          </a>
          <a href="#" className="block text-[6vw] ">
            Trending
          </a>
          <a href="#" className="block text-[6vw] ">
            Portfolio
          </a>
          <a href="#" className="block text-[6vw] ">
            Leaderboard
          </a>
          <a href="#" className="block text-[6vw] ">
            Docs
          </a>
          <a href="#" className="block text-[6vw] ">
            Contact
          </a>
        </nav>
      </div>

      {/* Connect Section */}
      <div className="flex flex-row items-start gap-15 justify-start font-display">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4">
          CONNECT
        </h3>
        <div className="space-y-1">
          <a href="#" className="block text-[6vw] ">
            LinkedIn
          </a>
          <a href="#" className="block text-[6vw] ">
            Instagram
          </a>
        </div>
      </div>
      <div className="flex flex-col w-full justify-end pt-8 items-end">
        <div className="flex justify-between gap-2 items itemspace-y-2 text-xs mb-6">
          <p className="block ">COOKIE POLICY</p>
          <p className="block ">LEGAL NOTICE & TERMS OF USE</p>
          <p className="block ">PRIVACY POLICY</p>
        </div>
      </div>
      <div className="mt-8 flex flex-col items-center">
        <div className="mb-4 w-full">
          <h1
            className="text-[17vw] font-black text-[#9C93E8] text-center tracking-widest leading-none"
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            TREDIE
          </h1>
        </div>

        <p className="text-xs w-fit mx-auto text-gray-200">
          COPYRIGHT © TREDIE 2026
        </p>
      </div>
    </footer>
  );
}
