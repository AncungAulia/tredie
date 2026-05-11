"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Hash, Coins, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";

const navLinks = [
  { href: "/topics",    label: "Topics",    icon: Hash    },
  { href: "/tokens",    label: "Tokens",    icon: Coins   },
  { href: "/portfolio", label: "Portfolio", icon: Wallet  },
];

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  return (
    <aside
      className={`fixed top-0 left-0 h-full z-50 hidden md:flex flex-col bg-[#09090B] border-r border-white/[0.05] transition-all duration-300 ease-in-out overflow-hidden ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      {/* Logo + collapse toggle */}
      <div
        className={`flex items-center h-16 shrink-0 border-b border-white/[0.05] transition-all duration-300 ${
          collapsed ? "justify-center gap-2" : "px-5 gap-2"
        }`}
      >
        <Link
          href="/topics"
          className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "" : "flex-1"}`}
        >
          <Image
            src="/tredie-favicon.svg"
            alt="Tredie"
            width={28}
            height={28}
            className="shrink-0"
          />
          <span
            className={`overflow-hidden transition-all duration-300 flex items-center ${
              collapsed ? "w-0 opacity-0" : "w-[72px] opacity-100"
            }`}
          >
            <Image
              src="/tredie-icon-logo.svg"
              alt="Tredie"
              width={72}
              height={18}
              className="h-3.5 w-auto shrink-0"
            />
          </span>
        </Link>
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 flex cursor-pointer items-center justify-center w-6 h-6 rounded-md text-white/30 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 pt-3">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center h-10 rounded-lg transition-all duration-200 ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              } ${
                isActive
                  ? "bg-[rgba(156,147,232,0.12)] text-[#9C93E8]"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              <span
                className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
