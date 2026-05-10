"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { x } = useSwipeNavigation();

  const isHideNav = pathname.startsWith("/tokens/") || pathname.startsWith("/topics/");

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <Header />
      <motion.main
        style={{ x }}
        className={`flex-1 pt-24 md:pb-12 px-8 md:px-12 w-full max-w-[1440px] mx-auto ${isHideNav ? "pb-8" : "pb-20"}`}
      >
        {children}
      </motion.main>
      {!isHideNav && <MobileBottomNav />}
    </div>
  );
}
