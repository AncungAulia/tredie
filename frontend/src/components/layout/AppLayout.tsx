"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { x } = useSwipeNavigation();
  const { collapsed } = useSidebar();

  const isHideNav =
    pathname.startsWith("/tokens/") || pathname.startsWith("/topics/");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className={`flex flex-col flex-1 transition-all duration-300 ${
          collapsed ? "md:pl-[60px]" : "md:pl-[220px]"
        }`}
      >
        <Header />
        <motion.main
          style={isHideNav ? undefined : { x }}
          className={`flex-1 pt-20 md:pt-24 md:pb-12 px-8 md:px-12 ${isHideNav ? "pb-8" : "pb-20"}`}
        >
          {children}
        </motion.main>
        {!isHideNav && <MobileBottomNav />}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}
