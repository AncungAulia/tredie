"use client";
import React, { useState } from "react";
import { mockPortfolioStats } from "@/lib/mock-data/markets";
import { Search } from "lucide-react";

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState<"positions" | "activity">("positions");

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-10">
      {/* Page title */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">Portfolio</h1>
        <p className="text-white/40 text-sm">Track your attention market positions and activity</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8 flex flex-col justify-center">
          <p className="text-white/40 text-sm mb-2">Portfolio Value</p>
          <h2 className="text-4xl font-sans font-bold">${mockPortfolioStats.totalValue.toFixed(2)}</h2>
        </div>

        <div className="md:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-8 grid grid-cols-2 sm:grid-cols-5 gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-white/40 text-xs">Realized PnL</span>
            <span className="font-mono text-sm">${mockPortfolioStats.realizedPnl.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-white/40 text-xs">Volume</span>
            <span className="font-mono text-sm">${mockPortfolioStats.volume.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-white/40 text-xs">Avg Profit/Trade</span>
            <span className="font-mono text-sm">${mockPortfolioStats.avgProfitPerTrade.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-white/40 text-xs">Trades</span>
            <span className="font-mono text-sm">{mockPortfolioStats.tradesCount}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-white/40 text-xs">Win Rate</span>
            <span className="font-mono text-sm">{mockPortfolioStats.winRate}%</span>
          </div>
        </div>
      </div>

      {/* Tabs + content */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-8 border-b border-white/[0.07]">
          <button
            className={`pb-4 text-sm font-medium relative transition-colors ${activeTab === "positions" ? "text-white" : "text-white/40 hover:text-white/70"}`}
            onClick={() => setActiveTab("positions")}
          >
            Positions
            {activeTab === "positions" && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#9C93E8] rounded-full" />
            )}
          </button>
          <button
            className={`pb-4 text-sm font-medium relative transition-colors ${activeTab === "activity" ? "text-white" : "text-white/40 hover:text-white/70"}`}
            onClick={() => setActiveTab("activity")}
          >
            Activity
            {activeTab === "activity" && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#9C93E8] rounded-full" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="flex justify-between items-center">
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/30" />
            </div>
            <input
              type="text"
              placeholder="Search positions..."
              className="block w-full pl-10 pr-4 py-2.5 border border-white/[0.07] rounded-xl leading-5 bg-white/[0.02] text-sm placeholder-white/30 text-white focus:outline-none focus:bg-white/[0.04] focus:border-[rgba(156,147,232,0.30)] transition-colors"
            />
          </div>
        </div>

        {/* Empty state */}
        <div className="w-full border border-white/[0.05] rounded-2xl bg-white/[0.02] overflow-hidden min-h-[320px] flex flex-col items-center justify-center gap-3">
          <p className="text-white/40 text-sm">No {activeTab} yet.</p>
          <p className="text-white/20 text-xs">Start trading to see your {activeTab} here.</p>
        </div>
      </div>
    </div>
  );
}
