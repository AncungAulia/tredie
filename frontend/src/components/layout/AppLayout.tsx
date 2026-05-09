"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main
        key={pathname}
        className="flex-1 pt-24 pb-12 px-8 lg:px-12 relative w-full max-w-[1440px] mx-auto animate-pageIn"
      >
        {children}
      </main>
    </div>
  );
}
