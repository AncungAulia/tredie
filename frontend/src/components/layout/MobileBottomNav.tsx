"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Coins, Wallet } from "lucide-react";

const items = [
  { href: "/topics", Icon: Flame },
  { href: "/tokens", Icon: Coins },
  { href: "/portfolio", Icon: Wallet },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 h-16 bg-[#09090B]/90 backdrop-blur-md border-t border-white/[0.07] flex items-center justify-around px-4">
      {items.map(({ href, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center w-14 h-14 rounded-xl transition-colors ${
              active ? "text-[#9C93E8]" : "text-white/35"
            }`}
          >
            <Icon size={22} />
          </Link>
        );
      })}
    </nav>
  );
}
