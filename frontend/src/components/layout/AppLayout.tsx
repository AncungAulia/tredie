"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Sembunyikan bottom nav di halaman detail (misal: /tokens/ADDRESS)
  const isHideNav = pathname.startsWith("/tokens/") || pathname.startsWith("/topics/");

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className={`flex-1 pt-24 md:pb-12 px-8 md:px-12 w-full max-w-[1440px] mx-auto ${isHideNav ? "pb-8" : "pb-20"}`}>
        {children}
      </main>
      {!isHideNav && <MobileBottomNav />}
    </div>
  );
}
