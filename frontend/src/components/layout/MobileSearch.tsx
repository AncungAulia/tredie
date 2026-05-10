"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { useSearch } from "@/hooks/useSearch";
import { resolveLink } from "@/lib/api/search";

const PLACEHOLDERS = ["Search ticker", "Search contract", "Paste a link"];
const URL_PATTERN = /^https?:\/\//i;

export default function MobileSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const phInnerRef = useRef<HTMLDivElement>(null);
  const phIdxRef = useRef(0);

  const isUrl = URL_PATTERN.test(query.trim());
  const { data: results = [] } = useSearch(isUrl ? "" : query);

  useEffect(() => {
    if (open) {
      setQuery("");
      phIdxRef.current = 0;
      gsap.set(phInnerRef.current, { yPercent: 0 });
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      phIdxRef.current = (phIdxRef.current + 1) % PLACEHOLDERS.length;
      gsap.to(phInnerRef.current, {
        yPercent: -(phIdxRef.current / PLACEHOLDERS.length) * 100,
        duration: 0.45,
        ease: "power2.inOut",
      });
    }, 2500);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!isUrl) return;
    const t = setTimeout(async () => {
      setResolving(true);
      try {
        const res = await resolveLink(query.trim());
        if (res.suggested_market_path) {
          router.push(res.suggested_market_path);
          onClose();
        }
      } finally {
        setResolving(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [query, isUrl]);

  function handleSelect(identifier: string, assetClass: number) {
    const path = assetClass === 6 ? "/topics" : "/tokens";
    router.push(`${path}/${encodeURIComponent(identifier)}`);
    onClose();
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="md:hidden fixed inset-0 z-[200] bg-[#09090B] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.07] shrink-0">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white p-1 -ml-1 shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder=""
            aria-label="Search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full pl-9 pr-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-full text-sm text-white focus:outline-none focus:border-[rgba(156,147,232,0.30)] transition-colors"
          />
          {/* Animated placeholder overlay */}
          {!query && !resolving && (
            <div className="absolute inset-y-0 left-9 right-3 flex items-center pointer-events-none">
              <div className="overflow-hidden h-5">
                <div ref={phInnerRef} className="flex flex-col">
                  {PLACEHOLDERS.map((text, i) => (
                    <span key={i} className="text-white/40 text-sm whitespace-nowrap leading-5 h-5 flex items-center">
                      {text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {resolving ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-2 text-white/30 text-sm">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <span>Resolving link…</span>
          </div>
        ) : isUrl ? (
          <div className="flex items-center justify-center pt-24 text-white/20 text-sm">
            Paste complete to resolve
          </div>
        ) : query.trim().length >= 2 && results.length > 0 ? (
          results.slice(0, 10).map((r, i) => (
            <button
              key={r.identifier ?? i}
              onClick={() => handleSelect(r.identifier, r.asset_class)}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-white/[0.05] active:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-white text-sm font-medium truncate">
                  {r.display_name ?? r.identifier}
                </span>
                <span className="text-white/30 text-xs font-mono truncate">{r.identifier}</span>
              </div>
              {!r.pda && (
                <span className="text-[10px] text-white/30 border border-white/10 px-1.5 py-0.5 rounded shrink-0 ml-3">
                  not spawned
                </span>
              )}
            </button>
          ))
        ) : query.trim().length >= 2 ? (
          <div className="flex items-center justify-center pt-24 text-white/30 text-sm">
            No results for &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center pt-24 gap-2 text-white/20 text-sm">
            <Search size={32} strokeWidth={1.5} />
            <span>Search tokens or topics</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
