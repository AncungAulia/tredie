import Link from "next/link";
import React from "react";

export default function Logo() {
  return (
    <Link href="/trends" className="shrink-0 flex items-center gap-2">
      <div className="w-8 h-8 rounded-md bg-[#A855F7] flex items-center justify-center">
        <span className="text-white font-sans font-bold text-lg">T</span>
      </div>
      <span className="text-[#FAFAFA] font-sans font-bold text-lg tracking-wide hidden sm:block">
        Tredie.
      </span>
    </Link>
  );
}
