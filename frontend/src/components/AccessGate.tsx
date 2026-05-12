"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Drawer } from "vaul";
import Image from "next/image";
import ScaleLoader from "react-spinners/ScaleLoader";

const CODE_LENGTH = 9;
const LS_KEY = "tredie_ac";

function OtpInputs({
  inputs,
  onChange,
  error,
  loading,
  onSubmit,
}: {
  inputs: string[];
  onChange: (inputs: string[]) => void;
  error: string;
  loading: boolean;
  onSubmit: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, val: string) => {
    const char = val
      .replace(/[^a-zA-Z]/g, "")
      .slice(-1)
      .toLowerCase();
    const next = [...inputs];
    next[idx] = char;
    onChange(next);
    if (char && idx < CODE_LENGTH - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (inputs[idx]) {
        const next = [...inputs];
        next[idx] = "";
        onChange(next);
      } else if (idx > 0) {
        refs.current[idx - 1]?.focus();
      }
    } else if (e.key === "Enter") {
      onSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase()
      .slice(0, CODE_LENGTH);
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((c, i) => {
      next[i] = c;
    });
    onChange(next);
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    refs.current[focusIdx]?.focus();
  };

  const filled = inputs.every((c) => c !== "");

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-1.5" onPaste={handlePaste}>
        {inputs.map((val, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="text"
            maxLength={2}
            value={val.toUpperCase()}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className={`w-8 h-10 md:w-9 md:h-11 text-center text-base md:text-lg font-mono font-semibold rounded-lg outline-none transition-all duration-150 bg-white/[0.05] border ${
              val
                ? "border-[#9C93E8]/60 text-white"
                : "border-white/[0.10] text-white/20"
            } focus:border-[#9C93E8] focus:shadow-[0_0_0_2px_rgba(156,147,232,0.15)] caret-transparent`}
          />
        ))}
      </div>

      {error && <p className="text-red-400 text-xs font-mono -mt-2">{error}</p>}

      <button
        onClick={onSubmit}
        disabled={!filled || loading}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background:
            filled && !loading
              ? "linear-gradient(135deg, #9C93E8, #7B72D8)"
              : "rgba(156,147,232,0.15)",
          color: filled && !loading ? "#fff" : "rgba(255,255,255,0.4)",
        }}
      >
        {loading ? "Verifying…" : "Enter"}
      </button>
    </div>
  );
}

function GateContent({
  inputs,
  onChange,
  error,
  loading,
  onSubmit,
}: {
  inputs: string[];
  onChange: (inputs: string[]) => void;
  error: string;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-col items-center gap-2 mt-1">
          <h2 className="text-white text-lg font-semibold tracking-tight">
            Enter Access Code
          </h2>
          <p className="text-white/35 text-xs text-center leading-relaxed max-w-[220px]">
            This app is in private beta. Get your access code by watching our intro video.
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <a
              href="https://x.com/tredie"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#9C93E8] text-[11px] font-medium hover:text-[#b8b2f0] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Watch on X
            </a>
          </div>
        </div>
      </div>
 
        <OtpInputs
          inputs={inputs}
          onChange={onChange}
          error={error}
          loading={loading}
          onSubmit={onSubmit}
        />
    
    </div>
  );
}

export default function AccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [inputs, setInputs] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    if (process.env.NEXT_PUBLIC_IS_PRODUCTION === "true") {
      const token = localStorage.getItem(LS_KEY);
      if (token) {
        fetch("/api/access/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
          .then((r) => r.json())
          .then((data) => setGranted(!!data.valid))
          .catch(() => setGranted(false));
      } else {
        setGranted(false);
      }
    } else {
      setGranted(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const code = inputs.join("").toLowerCase();
    if (code.length < CODE_LENGTH) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/access/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await r.json();
      if (data.token) {
        localStorage.setItem(LS_KEY, data.token);
        setGranted(true);
      } else {
        setError("Nice try :)");
        setInputs(Array(CODE_LENGTH).fill(""));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }, [inputs]);

  const showGate = granted === false;
  const contentProps = {
    inputs,
    onChange: setInputs,
    error,
    loading,
    onSubmit: handleSubmit,
  };

  return (
    <>
      {/* App content renders normally — no filter wrapper (avoids stacking context issues) */}
      {children}

      {/* Spinner while verifying stored token */}
      {granted === null && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-[#09090B]/80 backdrop-blur-sm">
          <ScaleLoader color="#9C93E8" height={24} width={3} margin={2} />
        </div>
      )}

      {/* Gate overlay — mobile: Vaul bottom sheet */}
      {showGate && isMobile && (
        <Drawer.Root open dismissible={false}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" />
            <Drawer.Content
              className="fixed bottom-0 left-0 right-0 z-[201] flex flex-col rounded-t-2xl outline-none"
              style={{ background: "#0E0E12", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Drawer.Title className="sr-only">Enter Access Code</Drawer.Title>
              <div className="mx-auto w-10 h-1 rounded-full bg-white/10 mt-3 mb-2" />
              <div className="px-6 pb-10 pt-4">
                <GateContent {...contentProps} />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}

      {/* Gate overlay — desktop: centered modal */}
      {showGate && !isMobile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="w-full max-w-md   mx-4 rounded-2xl p-8"
            style={{
              background: "#0E0E12",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          >
            <GateContent {...contentProps} />
          </div>
        </div>
      )}
    </>
  );
}
