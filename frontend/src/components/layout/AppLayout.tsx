"use client";
import React from "react";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 pt-24 pb-20 md:pb-12 px-8 md:px-12 w-full max-w-[1440px] mx-auto">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
