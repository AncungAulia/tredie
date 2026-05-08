"use client";
import React, { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSearch } from "@/hooks/useSearch";
import { resolveLink } from "@/lib/api/search";

const URL_PATTERN = /^https?:\/\//i;

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: results = [] } = useSearch(query);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    if (URL_PATTERN.test(q)) {
      setResolving(true);
      try {
        const res = await resolveLink(q);
        if (res.suggested_market_path) {
          router.push(res.suggested_market_path);
          setQuery("");
          setOpen(false);
        }
      } finally {
        setResolving(false);
      }
      return;
    }

    if (results[0]) {
      router.push(`/tokens/${encodeURIComponent(results[0].identifier)}`);
      setQuery("");
      setOpen(false);
    }
  }

  function handleSelect(identifier: string) {
    router.push(`/tokens/${encodeURIComponent(identifier)}`);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative w-full max-w-lg" ref={wrapperRef}>
      <form onSubmit={handleSubmit}>
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-white/40" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={resolving ? "Resolving link…" : "Search ticker, contract, or paste a link..."}
          disabled={resolving}
          className="block w-full pl-10 pr-3 py-2 border border-white/[0.07] rounded-full bg-white/[0.04] text-sm placeholder-white/40 text-white focus:outline-none focus:bg-white/[0.06] focus:border-[rgba(156,147,232,0.30)] transition-colors disabled:opacity-50"
        />
      </form>

      {open && query.trim().length >= 2 && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-[#111] border border-white/[0.10] rounded-xl shadow-xl z-50 overflow-hidden">
          {results.slice(0, 6).map((r) => (
            <button
              key={r.identifier}
              onClick={() => handleSelect(r.identifier)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.05] transition-colors text-left"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-white text-sm font-medium">{r.display_name ?? r.identifier}</span>
                <span className="text-white/30 text-xs font-mono">{r.identifier}</span>
              </div>
              {!r.pda && (
                <span className="text-[10px] text-white/30 border border-white/10 px-1.5 py-0.5 rounded">
                  not spawned
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
