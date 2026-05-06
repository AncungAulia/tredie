# Tredie Frontend — BUILD.md

Panduan implementasi lengkap frontend Tredie. Baca seluruh dokumen sebelum mulai coding.
Frontend adalah Next.js 15 App Router dengan Privy hybrid wallet, Zustand state management,
dan desain purple/violet yang data-dense tapi clean (Bloomberg terminal meets social feed).

---

## Daftar Isi

1. [Tech Stack & Versions](#1-tech-stack--versions)
2. [Prerequisites](#2-prerequisites)
3. [Setup Awal](#3-setup-awal)
4. [Folder Structure](#4-folder-structure)
5. [Environment Variables](#5-environment-variables)
6. [Tailwind Config & Design Tokens](#6-tailwind-config--design-tokens)
7. [Global Styles](#7-global-styles)
8. [Providers & Layout](#8-providers--layout)
9. [UI Components (Primitives)](#9-ui-components-primitives)
10. [Header Components](#10-header-components)
11. [Discovery Components](#11-discovery-components)
12. [Pages — Homepage](#12-pages--homepage)
13. [Market Detail Components](#13-market-detail-components)
14. [Pages — Market Detail](#14-pages--market-detail)
15. [Wallet Components](#15-wallet-components)
16. [Zustand Stores](#16-zustand-stores)
17. [Lib Utilities](#17-lib-utilities)
18. [Trade Flow (Complete)](#18-trade-flow-complete)
19. [Phase Build Order](#19-phase-build-order)
20. [Common Pitfalls](#20-common-pitfalls)

---

## 1. Tech Stack & Versions

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js | 15.x (App Router) |
| Runtime | Bun | latest |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Animation | Framer Motion | 11+ |
| Wallet | Privy | latest (`@privy-io/react-auth`) |
| State | Zustand | 5.x |
| Charts | Recharts | 2.x |
| Icons | Lucide React | latest |
| Fonts | Inter + JetBrains Mono | via `next/font` |
| HTTP | ky | latest |
| QR Code | qrcode.react | latest |
| Solana SDK | @solana/web3.js | 1.x |

> **Catatan Penting**: Privy Solana integration pakai `@privy-io/react-auth/solana`.
> External wallets (Phantom, Solflare) di-connect via Wallet Standard.
> Embedded wallet dibuat otomatis saat email/Google login.
> Gunakan `@solana/web3.js` v1 — sama dengan backend, bukan v2/kit.

---

## 2. Prerequisites

```bash
bun --version       # >= 1.1.0
node --version      # >= 20.0.0

# Yang harus sudah ada sebelum mulai frontend:
# - Backend running di http://localhost:4000
# - Privy App ID dari privy.io dashboard (reuse dari Predica/Swipenit)
# - NEXT_PUBLIC_TREDIE_PROGRAM_ID dari hasil anchor deploy
# - Helius RPC URL untuk devnet
```

---

## 3. Setup Awal

```bash
cd tredie

# Scaffold Next.js 15
bunx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd frontend

# Core dependencies
bun add @privy-io/react-auth
bun add zustand
bun add recharts
bun add framer-motion
bun add lucide-react
bun add ky
bun add qrcode.react

# Solana
bun add @solana/web3.js

# Dev
bun add -d @types/node
```

### `package.json` (scripts)

```json
{
  "name": "tredie-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

### `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'cdn.helius-rpc.com' },
      { hostname: 'raw.githubusercontent.com' },
      { hostname: 'arweave.net' },
      { hostname: 'pbs.twimg.com' },
      { hostname: 'abs.twimg.com' },
      { hostname: '*.ipfs.nftstorage.link' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

> **Mengapa rewrites?** Frontend proxy ke backend via `/api/v1/*` sehingga tidak ada
> CORS issue dan base URL tetap sama di semua environment.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 4. Folder Structure

```
frontend/
├── BUILD.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── .env.local                        ← TIDAK di-commit
├── public/
│   └── tredie-logo.svg               ← wordmark SVG
└── app/
    ├── layout.tsx                    ← Root layout: font + Providers
    ├── page.tsx                      ← Homepage: discovery feed
    ├── providers.tsx                 ← Privy + Toast context
    ├── globals.css                   ← Tailwind base + custom vars
    ├── markets/
    │   └── [identifier]/
    │       └── page.tsx              ← Market detail page
    ├── portfolio/
    │   └── page.tsx                  ← Holdings + PnL
    └── my-trends/
        └── page.tsx                  ← Markets created by user
components/
├── header/
│   ├── Header.tsx                    ← Sticky header wrapper (height 56px)
│   ├── Logo.tsx                      ← "Tredie" wordmark
│   ├── SearchBar.tsx                 ← Search + URL detection + dropdown
│   ├── ConnectButton.tsx             ← Login trigger / connected indicator
│   └── PortfolioButton.tsx           ← Ghost button → PortfolioDropdown
├── discovery/
│   ├── DiscoveryTabs.tsx             ← Topics | Tokens tabs
│   ├── TokenSubTabs.tsx              ← Trending | on X | on TG
│   ├── AssetClassFilter.tsx          ← Pill filter: All Crypto Equity Commodity FX
│   ├── MarketGrid.tsx                ← 4-col grid + skeleton loading
│   ├── MarketCard.tsx                ← Standard ticker card
│   └── CACard.tsx                    ← Contract address card variant
├── market/
│   ├── MarketHeader.tsx              ← Icon + name + price + stats row
│   ├── RatchetStatusBar.tsx          ← Ratchet progress bar + label
│   ├── DualChart.tsx                 ← Recharts: price + mindshare overlay
│   ├── ChartTimeRangeTabs.tsx        ← 1H | 6H | 24H | 1W | ALL
│   ├── TradePanel.tsx                ← Buy/sell form + Privy signing
│   ├── HoldersTable.tsx
│   ├── TradesTable.tsx
│   └── MarketContextCard.tsx         ← Link preview (Path 3 markets)
├── wallet/
│   ├── ConnectModal.tsx              ← Email + Google + Phantom + Solflare
│   ├── DepositModal.tsx              ← QR code + copy address
│   └── PortfolioDropdown.tsx         ← Balance dropdown from header
└── ui/
    ├── Button.tsx
    ├── Card.tsx
    ├── Tabs.tsx
    ├── Badge.tsx
    ├── Toast.tsx
    ├── Skeleton.tsx
    └── Spinner.tsx
lib/
├── api.ts                            ← Typed fetch wrappers untuk backend
├── solana.ts                         ← Connection + tx decode/send
├── privy.ts                          ← Wallet helpers
├── format.ts                         ← Number/date formatters
└── platform-detect.ts                ← Detect URL platform (twitter/tiktok/etc)
store/
├── markets.ts                        ← Market list + active market state
├── wallet.ts                         ← Wallet + balance + portfolio
└── trade.ts                          ← Active trade form state
```

---

## 5. Environment Variables

### `.env.example`

```bash
# Backend (wajib — frontend proxy ke sini via next.config rewrites)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Solana devnet
NEXT_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
NEXT_PUBLIC_TREDIE_PROGRAM_ID=EUAyjsbak9hRXPxU4zdDWwrL1Qy8RpwmfV9PNGKpdxBU
NEXT_PUBLIC_NETWORK=devnet

# Privy (reuse dari Predica/Swipenit)
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

> **Semua variabel `NEXT_PUBLIC_*`** akan di-bundle ke client-side bundle — jangan taruh
> secret di sini. Private key dan API secret hanya di backend.

---

## 6. Tailwind Config & Design Tokens

### `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#09090B',
          surface: 'rgba(255,255,255,0.04)',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          subtle: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.15)',
        },
        purple: {
          DEFAULT: '#A855F7',
          bright: '#C084FC',
          faint: 'rgba(168,85,247,0.12)',
          border: 'rgba(168,85,247,0.30)',
          glow: 'rgba(168,85,247,0.20)',
        },
        fuchsia: {
          DEFAULT: '#E879F9',
          faint: 'rgba(232,121,249,0.20)',
          glow: 'rgba(232,121,249,0.30)',
        },
        buy: '#22C55E',
        sell: '#EF4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 150ms ease forwards',
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
};

export default config;
```

### Color Reference — Gunakan di semua component

```
── Backgrounds ────────────────────────────────────────────
Halaman:         bg-[#09090B]
Card/surface:    bg-white/[0.04]
Card hover:      bg-[rgba(168,85,247,0.05)]

── Borders ────────────────────────────────────────────────
Normal:          border border-white/[0.07]
Hover:           hover:border-white/[0.15]
Active/purple:   border-[rgba(168,85,247,0.30)]

── Text ───────────────────────────────────────────────────
Primary:         text-[#FAFAFA]
Muted (labels):  text-white/40
Very muted:      text-white/25
Mono numbers:    font-mono

── Purple Accent ──────────────────────────────────────────
CTA bg:          bg-[#A855F7]
CTA text:        text-[#A855F7]
Hover:           text-[#C084FC]
Faint bg (badge/selected): bg-[rgba(168,85,247,0.12)]

── Ratchet Badges ─────────────────────────────────────────
1.0×  gray:    bg-[rgba(82,82,91,0.20)]   text-[#71717A]
2.0×  purple:  bg-[rgba(168,85,247,0.15)] text-[#A855F7]
3.5×  bright:  bg-[rgba(192,132,252,0.15)] text-[#C084FC]
5.0×  fuchsia: bg-[rgba(232,121,249,0.20)] text-[#E879F9]
               shadow-[0_0_8px_rgba(232,121,249,0.30)]

── Trade ──────────────────────────────────────────────────
Buy/positive:   text-[#22C55E]   bg-[#22C55E]
Sell/negative:  text-[#EF4444]   bg-[#EF4444]
```


---

## 7. Global Styles

### `app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #09090B;
  --foreground: #FAFAFA;
}

* {
  box-sizing: border-box;
}

html {
  background-color: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  min-height: 100vh;
  background-color: var(--background);
}

/* Scrollbar styling — dark minimal */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }

/* Recharts custom colors */
.recharts-cartesian-grid-horizontal line,
.recharts-cartesian-grid-vertical line {
  stroke: rgba(255,255,255,0.05);
}
.recharts-tooltip-wrapper { outline: none; }
```

---

## 8. Providers & Layout

### `app/providers.tsx`

```tsx
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#A855F7',
          logo: '/tredie-logo.svg',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors({
              shouldAutoConnect: true,
            }),
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

### `app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { Providers } from './providers';
import { Header } from '@/components/header/Header';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = localFont({
  src: '../public/fonts/JetBrainsMono-Variable.woff2',
  variable: '--font-jetbrains',
  display: 'swap',
  fallback: ['JetBrains Mono', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Tredie — On-Chain Attention Market',
  description: 'Trade social attention on crypto, equities, and commodities on Solana.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="bg-[#09090B] text-[#FAFAFA] font-sans">
        <Providers>
          <Header />
          <main className="pt-14 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
```

> **Catatan**: `pt-14` pada `<main>` mengimbangi sticky header 56px.
> JetBrains Mono perlu didownload dari fonts.google.com lalu taruh di `public/fonts/`.
> Alternatif: pakai `next/font/google` jika tidak self-host.

---

## 9. UI Components (Primitives)

### `components/ui/Button.tsx`

```tsx
import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'buy' | 'sell' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className = '', disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-mono font-semibold transition-all duration-150 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary: 'bg-[#A855F7] text-white hover:bg-[#9333EA]',
      ghost: 'bg-transparent text-white/40 hover:text-white hover:bg-white/[0.06]',
      outline: 'bg-transparent border border-white/[0.10] text-[#FAFAFA] hover:border-white/[0.20]',
      buy: 'bg-[#22C55E] text-black hover:bg-[#16A34A]',
      sell: 'bg-[#EF4444] text-white hover:bg-[#DC2626]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

### `components/ui/Card.tsx`

```tsx
import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className = '', children, ...props }: CardProps) {
  const hoverClass = hover
    ? 'hover:border-[rgba(168,85,247,0.30)] hover:bg-[rgba(168,85,247,0.05)] cursor-pointer'
    : '';

  return (
    <div
      className={`bg-white/[0.04] border border-white/[0.07] rounded-[12px] p-4 transition-all duration-150 ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
```

### `components/ui/Badge.tsx`

```tsx
interface BadgeProps {
  label: string;
  type?: 'crypto' | 'equity' | 'commodity' | 'fx' | 'ca' | 'buy' | 'sell';
}

const typeStyles: Record<string, string> = {
  crypto:    'bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.25)] text-[#A855F7]',
  equity:    'bg-[rgba(34,197,94,0.12)]  border border-[rgba(34,197,94,0.25)]  text-[#22C55E]',
  commodity: 'bg-[rgba(251,191,36,0.12)] border border-[rgba(251,191,36,0.25)] text-[#FBBF24]',
  fx:        'bg-[rgba(96,165,250,0.12)] border border-[rgba(96,165,250,0.25)] text-[#60A5FA]',
  ca:        'bg-white/[0.06]            border border-white/[0.12]            text-white/60',
  buy:       'bg-[rgba(34,197,94,0.15)]  border border-[rgba(34,197,94,0.30)]  text-[#22C55E]',
  sell:      'bg-[rgba(239,68,68,0.15)]  border border-[rgba(239,68,68,0.30)]  text-[#EF4444]',
};

export function Badge({ label, type = 'crypto' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-mono ${typeStyles[type]}`}>
      {label}
    </span>
  );
}
```

### `components/ui/Skeleton.tsx`

```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-white/[0.06] animate-shimmer bg-gradient-to-r from-white/[0.06] via-white/[0.10] to-white/[0.06] bg-[length:200%_100%] ${className}`}
    />
  );
}
```

### `components/ui/Spinner.tsx`

```tsx
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
```

---

## 10. Header Components

### `components/header/Header.tsx`

```tsx
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { ConnectButton } from './ConnectButton';
import { PortfolioButton } from './PortfolioButton';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#09090B]/90 backdrop-blur-sm border-b border-white/[0.07] flex items-center px-6 gap-6">
      <Logo />
      <div className="flex-1 max-w-2xl mx-auto">
        <SearchBar />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <PortfolioButton />
        <ConnectButton />
      </div>
    </header>
  );
}
```

### `components/header/Logo.tsx`

```tsx
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="shrink-0">
      <span className="text-[#FAFAFA] font-sans font-bold text-lg tracking-wide">
        Tredie
      </span>
    </Link>
  );
}
```

### `components/header/SearchBar.tsx`

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { detectPlatform } from '@/lib/platform-detect';
import type { SearchSuggestion } from '@/lib/api';

export function SearchBar() {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

  useEffect(() => {
    if (input.length < 2) { setSuggestions([]); setOpen(false); return; }
    if (isUrl(input)) {
      const platform = detectPlatform(input);
      setSuggestions([{ type: 'link', value: input, display: `Resolve ${platform} link...` }]);
      setOpen(true);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(input)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setOpen(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [input]);

  async function handleSelect(suggestion: SearchSuggestion) {
    setOpen(false);
    if (suggestion.type === 'link') {
      setResolving(true);
      try {
        const res = await fetch('/api/v1/resolve-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: suggestion.value }),
        });
        const data = await res.json();
        if (data.suggestedMarketPath) {
          router.push(data.suggestedMarketPath);
        } else {
          alert("Couldn't extract a tradable asset from this link");
        }
      } finally {
        setResolving(false);
        setInput('');
      }
    } else {
      router.push(`/markets/${encodeURIComponent(suggestion.value)}`);
      setInput('');
    }
  }

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions[0]) handleSelect(suggestions[0]);
          if (e.key === 'Escape') { setOpen(false); setInput(''); }
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search ticker, contract, or paste a link..."
        className="w-full h-9 pl-9 pr-9 bg-white/[0.06] border border-white/[0.10] rounded-full text-[#FAFAFA] placeholder-white/30 text-sm font-mono focus:outline-none focus:border-white/[0.25] transition-colors"
      />
      {input && (
        <button onClick={() => { setInput(''); setSuggestions([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#111113] border border-white/[0.10] rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.05] transition-colors"
            >
              <span className="text-white/25 text-[11px] font-mono uppercase w-12 shrink-0">
                {s.type === 'link' ? 'URL' : s.type === 'ca' ? 'CA' : 'SYM'}
              </span>
              <span className="text-[#FAFAFA] text-sm font-mono truncate">{s.display}</span>
            </button>
          ))}
        </div>
      )}
      {resolving && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
```

### `components/header/ConnectButton.tsx`

```tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useState } from 'react';
import { ConnectModal } from '@/components/wallet/ConnectModal';

export function ConnectButton() {
  const { ready, authenticated, user, logout } = usePrivy();
  const [showModal, setShowModal] = useState(false);

  if (!ready) {
    return <div className="w-20 h-8 bg-white/[0.06] rounded-lg animate-pulse" />;
  }

  if (authenticated && user) {
    const addr = user.wallet?.address;
    const display = addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : user.email?.address?.split('@')[0];
    return (
      <button
        onClick={() => logout()}
        className="h-8 px-3 text-xs font-mono text-white/60 border border-white/[0.10] rounded-lg hover:border-white/[0.20] hover:text-white transition-all"
      >
        {display}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="h-8 px-4 text-sm font-mono font-semibold bg-[#A855F7] text-white rounded-lg hover:bg-[#9333EA] transition-colors"
      >
        Connect
      </button>
      <ConnectModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
```

### `components/header/PortfolioButton.tsx`

```tsx
'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ChevronDown } from 'lucide-react';
import { PortfolioDropdown } from '@/components/wallet/PortfolioDropdown';

export function PortfolioButton() {
  const { authenticated } = usePrivy();
  const [open, setOpen] = useState(false);

  if (!authenticated) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-3 text-sm text-white/40 hover:text-white font-mono transition-colors"
      >
        Portfolio
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <PortfolioDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
```

---

## 11. Discovery Components

### `components/discovery/DiscoveryTabs.tsx`

```tsx
'use client';

type Tab = 'topics' | 'tokens';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function DiscoveryTabs({ active, onChange }: Props) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'topics', label: 'Topics' },
    { key: 'tokens', label: 'Tokens' },
  ];

  return (
    <div className="border-b border-white/[0.07] flex">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-3 text-sm font-sans transition-colors relative ${
            active === t.key
              ? 'text-[#FAFAFA]'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {t.label}
          {active === t.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FAFAFA]" />
          )}
        </button>
      ))}
    </div>
  );
}
```

### `components/discovery/TokenSubTabs.tsx`

```tsx
'use client';

type SubTab = 'trending' | 'x' | 'tg';

interface Props {
  active: SubTab;
  onChange: (tab: SubTab) => void;
}

export function TokenSubTabs({ active, onChange }: Props) {
  const tabs: { key: SubTab; label: string }[] = [
    { key: 'trending', label: 'Trending' },
    { key: 'x', label: 'on X' },
    { key: 'tg', label: 'on TG' },
  ];

  return (
    <div className="border-b border-white/[0.07] flex">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-[13px] font-sans transition-colors relative ${
            active === t.key
              ? 'text-[#A855F7]'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          {t.label}
          {active === t.key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#A855F7]" />
          )}
        </button>
      ))}
    </div>
  );
}
```

### `components/discovery/AssetClassFilter.tsx`

```tsx
'use client';

type AssetClass = 0 | 1 | 2 | 3 | 4 | 'all';

const CLASSES: { value: AssetClass; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 0, label: 'Crypto' },
  { value: 1, label: 'Equity' },
  { value: 2, label: 'Commodity' },
  { value: 3, label: 'FX' },
];

interface Props {
  active: AssetClass;
  onChange: (cls: AssetClass) => void;
}

export function AssetClassFilter({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CLASSES.map((c) => {
        const isActive = active === c.value;
        return (
          <button
            key={String(c.value)}
            onClick={() => onChange(c.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              isActive
                ? 'bg-[rgba(168,85,247,0.15)] border-[rgba(168,85,247,0.40)] text-[#C084FC]'
                : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/[0.15]'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
```

### `components/discovery/MarketCard.tsx`

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { RatchetBadge } from './RatchetBadge';
import { formatPrice, formatCompact, formatPct } from '@/lib/format';
import type { MarketRow } from '@/lib/api';

export function MarketCard({ market }: { market: MarketRow }) {
  const pctChange = 0; // TODO: derive from trade history
  const isPositive = pctChange >= 0;
  const mindsharePct = Math.min((market.current_mindshare_bps / 100), 100);

  return (
    <Link href={`/markets/${encodeURIComponent(market.identifier)}`}>
      <div className="group bg-white/[0.04] border border-white/[0.07] rounded-[12px] p-4 transition-all duration-150 hover:border-[rgba(168,85,247,0.30)] hover:bg-[rgba(168,85,247,0.05)] cursor-pointer">
        {/* Header row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {market.image_url ? (
              <Image src={market.image_url} alt={market.identifier} width={32} height={32} className="rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-xs font-mono text-white/40">
                {market.identifier.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-[#FAFAFA] font-mono font-semibold text-sm">
              {market.identifier.startsWith('xyz:') ? market.identifier.replace('xyz:', '') : market.identifier.slice(0, 8)}
            </span>
          </div>
          <RatchetBadge ratchetBps={market.ratchet_multiplier_bps} />
        </div>

        {/* Display name */}
        {market.display_name && (
          <p className="text-white/25 text-[11px] font-sans mb-3 truncate">{market.display_name}</p>
        )}

        {/* Price + change */}
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[#FAFAFA] font-mono text-base">
            {formatPrice(market.real_sol_reserves, market.tokens_minted)}
          </span>
          <span className={`font-mono text-sm ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {isPositive ? '+' : ''}{formatPct(pctChange)}
          </span>
        </div>

        {/* Mindshare bar */}
        <div className="mb-1">
          <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#A855F7] rounded-full transition-all"
              style={{ width: `${mindsharePct}%` }}
            />
          </div>
          <span className="text-white/25 text-[11px] font-sans mt-1 block">mindshare {mindsharePct.toFixed(0)}%</span>
        </div>

        {/* Footer */}
        <div className="text-white/25 text-[11px] font-mono mt-2 border-t border-white/[0.05] pt-2">
          Vol {formatCompact(market.real_sol_reserves)} SOL · {formatCompact(0)} holders
        </div>
      </div>
    </Link>
  );
}
```

### `components/discovery/RatchetBadge.tsx`

```tsx
interface Props { ratchetBps: number; }

export function RatchetBadge({ ratchetBps }: Props) {
  const multiplier = ratchetBps / 10000;
  const label = `${multiplier.toFixed(1)}×`;

  let cls = '';
  if (multiplier >= 5.0) {
    cls = 'bg-[rgba(232,121,249,0.20)] border border-[rgba(232,121,249,0.40)] text-[#E879F9] shadow-[0_0_8px_rgba(232,121,249,0.30)]';
  } else if (multiplier >= 3.5) {
    cls = 'bg-[rgba(192,132,252,0.15)] border border-[rgba(192,132,252,0.30)] text-[#C084FC]';
  } else if (multiplier >= 2.0) {
    cls = 'bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.30)] text-[#A855F7]';
  } else {
    cls = 'bg-[rgba(82,82,91,0.20)] border border-white/[0.08] text-[#71717A]';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${cls}`}>
      {label}
    </span>
  );
}
```

### `components/discovery/MarketGrid.tsx`

```tsx
import { MarketCard } from './MarketCard';
import { CACard } from './CACard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MarketRow } from '@/lib/api';

interface Props {
  markets: MarketRow[];
  loading?: boolean;
}

export function MarketGrid({ markets, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-[160px]" />
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-16 text-white/25 font-mono">
        No markets found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {markets.map((m) => (
        m.asset_class === 5
          ? <CACard key={m.pda} market={m} />
          : <MarketCard key={m.pda} market={m} />
      ))}
    </div>
  );
}
```

### `components/discovery/CACard.tsx`

```tsx
import Link from 'next/link';
import { RatchetBadge } from './RatchetBadge';
import { formatCompact } from '@/lib/format';
import type { MarketRow } from '@/lib/api';

export function CACard({ market }: { market: MarketRow }) {
  const shortAddr = `${market.identifier.slice(0, 4)}…${market.identifier.slice(-4)}`;

  return (
    <Link href={`/markets/${encodeURIComponent(market.identifier)}`}>
      <div className="group bg-white/[0.04] border border-white/[0.07] rounded-[12px] p-4 transition-all duration-150 hover:border-[rgba(168,85,247,0.30)] hover:bg-[rgba(168,85,247,0.05)] cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-mono text-white/30">
              CA
            </div>
            <div>
              <div className="text-[#FAFAFA] font-mono text-sm font-semibold">
                {market.display_name || shortAddr}
              </div>
              <div className="text-white/25 text-[11px] font-mono">{shortAddr}</div>
            </div>
          </div>
          <RatchetBadge ratchetBps={market.ratchet_multiplier_bps} />
        </div>
        <div className="text-white/25 text-[11px] font-mono mt-3 border-t border-white/[0.05] pt-2">
          {formatCompact(market.real_sol_reserves)} SOL reserves
        </div>
      </div>
    </Link>
  );
}
```


---

## 12. Pages — Homepage

### `app/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { DiscoveryTabs } from '@/components/discovery/DiscoveryTabs';
import { TokenSubTabs } from '@/components/discovery/TokenSubTabs';
import { AssetClassFilter } from '@/components/discovery/AssetClassFilter';
import { MarketGrid } from '@/components/discovery/MarketGrid';
import { api } from '@/lib/api';
import type { MarketRow } from '@/lib/api';

type DiscoveryTab = 'topics' | 'tokens';
type TokenSubTab = 'trending' | 'x' | 'tg';
type AssetClass = 0 | 1 | 2 | 3 | 4 | 'all';

export default function HomePage() {
  const [discTab, setDiscTab] = useState<DiscoveryTab>('tokens');
  const [subTab, setSubTab] = useState<TokenSubTab>('trending');
  const [assetClass, setAssetClass] = useState<AssetClass>('all');
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ac = assetClass === 'all' ? undefined : assetClass;
    api.getMarkets({ assetClass: ac, sortBy: 'mindshare', limit: 24 })
      .then(setMarkets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assetClass, subTab]);

  const filteredMarkets = subTab === 'x' || subTab === 'tg'
    ? markets.filter(m => m.asset_class === 5)
    : markets;

  return (
    <div className="max-w-[1440px] mx-auto px-6">
      {/* Discovery tabs */}
      <div className="mt-0 sticky top-14 z-40 bg-[#09090B]">
        <DiscoveryTabs active={discTab} onChange={setDiscTab} />
        {discTab === 'tokens' && (
          <TokenSubTabs active={subTab} onChange={setSubTab} />
        )}
      </div>

      <div className="py-5">
        {discTab === 'tokens' && subTab === 'trending' && (
          <div className="mb-4">
            <AssetClassFilter active={assetClass} onChange={setAssetClass} />
          </div>
        )}

        {discTab === 'topics' ? (
          <div className="text-center py-20 text-white/25 font-mono text-sm">
            Topics tab — coming soon (Phase 7)
          </div>
        ) : (
          <MarketGrid markets={filteredMarkets} loading={loading} />
        )}
      </div>
    </div>
  );
}
```

---

## 13. Market Detail Components

### `components/market/MarketHeader.tsx`

```tsx
import Image from 'next/image';
import { formatPrice, formatCompact, formatPct } from '@/lib/format';
import { RatchetBadge } from '@/components/discovery/RatchetBadge';
import type { MarketDetail } from '@/lib/api';

export function MarketHeader({ market }: { market: MarketDetail }) {
  const pctChange = 0; // TODO: compute from trade history
  const isPositive = pctChange >= 0;
  const assetLabels = ['Crypto', 'Equity', 'Commodity', 'FX', 'Index', 'CA'];

  return (
    <div className="mb-5">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {market.image_url ? (
            <Image src={market.image_url} alt={market.identifier} width={40} height={40} className="rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-sm font-mono text-white/40">
              {market.identifier.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[#FAFAFA] font-mono font-bold text-xl">
                {market.identifier.replace('xyz:', '')}
              </h1>
              <RatchetBadge ratchetBps={market.ratchet_multiplier_bps} />
            </div>
            <p className="text-white/40 text-sm font-sans">
              {market.display_name} · {assetLabels[market.asset_class]}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[#FAFAFA] font-mono text-2xl font-semibold">
            {formatPrice(market.real_sol_reserves, market.tokens_minted)}
          </div>
          <div className={`font-mono text-sm ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {isPositive ? '↑' : '↓'} {isPositive ? '+' : ''}{formatPct(pctChange)}
          </div>
        </div>
      </div>
      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 text-white/40 text-[13px] font-mono">
        <span>Mkt Cap <span className="text-white/60">{formatCompact(market.real_sol_reserves)} SOL</span></span>
        <span className="text-white/[0.12]">·</span>
        <span>Mindshare <span className="text-white/60">{(market.current_mindshare_bps / 100).toFixed(1)}%</span></span>
        <span className="text-white/[0.12]">·</span>
        <span>Holders <span className="text-white/60">—</span></span>
      </div>
    </div>
  );
}
```

### `components/market/RatchetStatusBar.tsx`

```tsx
import type { MarketDetail } from '@/lib/api';

export function RatchetStatusBar({ market }: { market: MarketDetail }) {
  const multiplier = market.ratchet_multiplier_bps / 10_000;
  const pct = Math.min((multiplier / 5.0) * 100, 100);

  return (
    <div className="rounded-[10px] border border-[rgba(168,85,247,0.20)] bg-[rgba(168,85,247,0.08)] p-3 mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#A855F7] text-sm font-mono font-semibold">
          Attention Ratchet {multiplier.toFixed(1)}×
        </span>
        <span className="text-white/40 text-[12px] font-mono">
          ↑ from 1.0× · max 5.0×
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: multiplier >= 5 ? '#E879F9' : multiplier >= 3.5 ? '#C084FC' : '#A855F7',
            boxShadow: multiplier >= 5 ? '0 0 8px rgba(232,121,249,0.50)' : undefined,
          }}
        />
      </div>
      <p className="text-white/30 text-[11px] font-sans">
        Price floor boosted +{((multiplier - 1) * 100).toFixed(0)}% since market creation
      </p>
    </div>
  );
}
```

### `components/market/DualChart.tsx`

```tsx
'use client';

import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { formatCompact } from '@/lib/format';

interface ChartPoint {
  timestamp: number;
  price: number;
  mindshare: number;
  isRatchetEvent?: boolean;
}

interface Props {
  data: ChartPoint[];
  ratchetEvents?: { timestamp: number; label: string }[];
}

export function DualChart({ data, ratchetEvents = [] }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-white/20 text-sm font-mono">
        No chart data yet
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) => new Date(v * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 11, fontFamily: 'var(--font-jetbrains)' }}
            axisLine={false}
            tickLine={false}
          />
          {/* Left Y: price */}
          <YAxis
            yAxisId="price"
            orientation="left"
            tickFormatter={(v) => formatCompact(v)}
            tick={{ fill: 'rgba(255,255,255,0.40)', fontSize: 11, fontFamily: 'var(--font-jetbrains)' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          {/* Right Y: mindshare % */}
          <YAxis
            yAxisId="mindshare"
            orientation="right"
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#A855F7', fontSize: 11, fontFamily: 'var(--font-jetbrains)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{ background: '#111113', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, fontFamily: 'var(--font-jetbrains)', fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.40)' }}
            itemStyle={{ color: '#FAFAFA' }}
          />
          {/* Ratchet event reference lines */}
          {ratchetEvents.map((e, i) => (
            <ReferenceLine
              key={i}
              x={e.timestamp}
              yAxisId="price"
              stroke="rgba(168,85,247,0.50)"
              strokeDasharray="4 4"
              label={{ value: '⬧', fill: '#A855F7', fontSize: 12 }}
            />
          ))}
          {/* Mindshare area */}
          <Area
            yAxisId="mindshare"
            type="monotone"
            dataKey="mindshare"
            stroke="#A855F7"
            strokeWidth={1.5}
            fill="rgba(168,85,247,0.10)"
            dot={false}
            activeDot={{ r: 3, fill: '#A855F7' }}
          />
          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke="#FAFAFA"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#FAFAFA' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 text-[11px] font-mono text-white/30">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-[#FAFAFA] inline-block" /> Price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-[#A855F7] inline-block" /> Mindshare
        </span>
        <span className="text-[#A855F7]">⬧ Ratchet event</span>
      </div>
    </div>
  );
}
```

### `components/market/ChartTimeRangeTabs.tsx`

```tsx
'use client';

type Range = '1H' | '6H' | '24H' | '1W' | 'ALL';

interface Props { active: Range; onChange: (r: Range) => void; }

const RANGES: Range[] = ['1H', '6H', '24H', '1W', 'ALL'];

export function ChartTimeRangeTabs({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-white/[0.07] pb-0">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-2 text-xs font-mono transition-colors ${
            active === r ? 'text-[#FAFAFA]' : 'text-white/30 hover:text-white/60'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
```

### `components/market/TradePanel.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import { Connection, Transaction } from '@solana/web3.js';
import { Button } from '@/components/ui/Button';
import { formatCompact } from '@/lib/format';
import type { MarketDetail } from '@/lib/api';

interface Props { market: MarketDetail; }

export function TradePanel({ market }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [estimate, setEstimate] = useState<string | null>(null);
  const [slippage] = useState(500); // 5% default
  const [loading, setLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  // Estimate output on amount change
  useEffect(() => {
    if (!amount || Number(amount) <= 0) { setEstimate(null); return; }
    const timer = setTimeout(async () => {
      const res = await fetch('/api/v1/markets/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: market.identifier, side, amount: Number(amount), slippageBps: slippage }),
      });
      const data = await res.json();
      setEstimate(data.tokensOut ?? data.solOut ?? null);
    }, 300);
    return () => clearTimeout(timer);
  }, [amount, side, slippage, market.identifier]);

  async function handleSubmit() {
    if (!authenticated) { login(); return; }
    const wallet = wallets[0];
    if (!wallet || !amount) return;
    setLoading(true);
    setTxError(null);
    setTxSuccess(null);
    try {
      // 1. Backend builds unsigned tx
      const res = await fetch('/api/v1/markets/prepare-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: market.identifier,
          side,
          amount: Number(amount),
          slippageBps: slippage,
          trader: wallet.address,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { transaction: txBase64 } = await res.json();

      // 2. Decode + sign via Privy
      const tx = Transaction.from(Buffer.from(txBase64, 'base64'));
      const signedTx = await wallet.signTransaction(tx);

      // 3. Send to network
      const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!);
      const sig = await conn.sendRawTransaction(signedTx.serialize());
      await conn.confirmTransaction(sig, 'confirmed');
      setTxSuccess(sig);
      setAmount('');
    } catch (e: any) {
      setTxError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const ticker = market.identifier.replace('xyz:', '');

  return (
    <div className="sticky top-[72px]">
      <div className="bg-white/[0.04] border border-white/[0.07] rounded-[12px] p-4">
        {/* Buy / Sell toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSide('buy')}
            className={`flex-1 h-9 rounded-lg text-sm font-mono font-semibold transition-all ${
              side === 'buy'
                ? 'bg-[#A855F7] text-white'
                : 'bg-transparent text-white/40 hover:text-white border border-white/[0.08]'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('sell')}
            className={`flex-1 h-9 rounded-lg text-sm font-mono font-semibold transition-all ${
              side === 'sell'
                ? 'bg-[#EF4444] text-white'
                : 'bg-transparent text-white/40 hover:text-white border border-white/[0.08]'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Amount input */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-white/40 text-xs font-mono">
              {side === 'buy' ? 'You pay (SOL)' : `You sell (${ticker})`}
            </span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full bg-transparent text-[32px] font-mono text-[#FAFAFA] outline-none placeholder-white/15 border-b border-white/[0.08] pb-2 mb-2"
          />
        </div>

        {/* Estimate output */}
        {estimate && (
          <div className="bg-white/[0.03] rounded-lg p-3 mb-3">
            <div className="text-[#FAFAFA] font-mono text-lg">
              ≈ {formatCompact(Number(estimate))} {side === 'buy' ? ticker : 'SOL'}
            </div>
            <div className="text-white/30 text-[11px] font-sans">estimated {side === 'buy' ? 'tokens' : 'SOL'}</div>
          </div>
        )}

        {/* Trade details */}
        <div className="space-y-1.5 mb-4">
          {[
            { label: 'Slippage', value: `${slippage / 100}%` },
            { label: 'Ratchet', value: `${(market.ratchet_multiplier_bps / 10000).toFixed(1)}×`, purple: true },
            { label: 'Fee', value: '1.00%' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-[13px] font-mono">
              <span className="text-white/30">{row.label}</span>
              <span className={row.purple ? 'text-[#A855F7]' : 'text-white/50'}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {!authenticated ? (
          <Button variant="primary" size="lg" className="w-full" onClick={login}>
            Connect to Trade
          </Button>
        ) : (
          <Button
            variant={side === 'buy' ? 'primary' : 'sell'}
            size="lg"
            className="w-full"
            loading={loading}
            disabled={!amount || Number(amount) <= 0}
            onClick={handleSubmit}
          >
            {side === 'buy' ? `Buy ${ticker}` : `Sell ${ticker}`}
          </Button>
        )}

        {txError && <p className="text-[#EF4444] text-xs font-mono mt-2 break-all">{txError}</p>}
        {txSuccess && (
          <p className="text-[#22C55E] text-xs font-mono mt-2">
            Confirmed! <a href={`https://solscan.io/tx/${txSuccess}?cluster=devnet`} target="_blank" className="underline">View on Solscan</a>
          </p>
        )}
      </div>

      {/* Embedded wallet deposit hint */}
      {authenticated && wallets.length > 0 && (
        <WalletCard wallet={wallets[0]} />
      )}
    </div>
  );
}

function WalletCard({ wallet }: { wallet: any }) {
  const [showDeposit, setShowDeposit] = useState(false);
  const addr = wallet.address as string;
  return (
    <div className="mt-3 bg-[rgba(168,85,247,0.06)] border border-[rgba(168,85,247,0.15)] rounded-lg p-3 flex items-center justify-between">
      <div>
        <div className="text-white/60 text-xs font-mono">{`${addr.slice(0, 6)}…${addr.slice(-4)}`}</div>
        <div className="text-white/30 text-[11px] font-sans">Solana wallet</div>
      </div>
      <button
        onClick={() => setShowDeposit(true)}
        className="text-[#A855F7] text-xs font-mono hover:text-[#C084FC] transition-colors"
      >
        Deposit ↗
      </button>
    </div>
  );
}
```

### `components/market/HoldersTable.tsx`

```tsx
import { formatCompact } from '@/lib/format';

interface Holder {
  rank: number;
  wallet: string;
  tokenAmount: number;
  valueUsd: number;
  pctSupply: number;
}

export function HoldersTable({ holders }: { holders: Holder[] }) {
  if (!holders.length) {
    return <p className="text-white/25 text-sm font-mono py-4">No holders yet</p>;
  }
  return (
    <table className="w-full text-sm font-mono">
      <thead>
        <tr className="text-white/30 text-[11px] border-b border-white/[0.06]">
          <th className="text-left py-2 pr-4">#</th>
          <th className="text-left py-2 pr-4">Wallet</th>
          <th className="text-right py-2 pr-4">Tokens</th>
          <th className="text-right py-2 pr-4">Value</th>
          <th className="text-right py-2">% Supply</th>
        </tr>
      </thead>
      <tbody>
        {holders.map((h) => (
          <tr key={h.rank} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
            <td className="py-2 pr-4 text-white/30">{h.rank}</td>
            <td className="py-2 pr-4 text-[#FAFAFA]">{h.wallet.slice(0, 4)}…{h.wallet.slice(-4)}</td>
            <td className="py-2 pr-4 text-right text-white/60">{formatCompact(h.tokenAmount)}</td>
            <td className="py-2 pr-4 text-right text-white/60">${h.valueUsd.toFixed(2)}</td>
            <td className="py-2 text-right text-white/40">{h.pctSupply.toFixed(2)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### `components/market/TradesTable.tsx`

```tsx
import { Badge } from '@/components/ui/Badge';
import { formatCompact } from '@/lib/format';

interface Trade {
  signature: string;
  side: 0 | 1;
  trader: string;
  sol_amount: number;
  token_amount: number;
  block_time: number;
}

export function TradesTable({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return <p className="text-white/25 text-sm font-mono py-4">No trades yet</p>;
  }
  return (
    <table className="w-full text-sm font-mono">
      <thead>
        <tr className="text-white/30 text-[11px] border-b border-white/[0.06]">
          <th className="text-left py-2 pr-4">Type</th>
          <th className="text-right py-2 pr-4">Tokens</th>
          <th className="text-right py-2 pr-4">SOL</th>
          <th className="text-left py-2 pr-4">Wallet</th>
          <th className="text-right py-2">Time</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => {
          const ago = Math.floor((Date.now() / 1000 - t.block_time) / 60);
          return (
            <tr key={t.signature} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
              <td className="py-2 pr-4">
                <Badge label={t.side === 0 ? 'BUY' : 'SELL'} type={t.side === 0 ? 'buy' : 'sell'} />
              </td>
              <td className="py-2 pr-4 text-right text-white/60">{formatCompact(t.token_amount)}</td>
              <td className="py-2 pr-4 text-right text-[#FAFAFA]">{(t.sol_amount / 1e9).toFixed(3)}</td>
              <td className="py-2 pr-4 text-white/40">{t.trader.slice(0, 4)}…{t.trader.slice(-4)}</td>
              <td className="py-2 text-right text-white/30">{ago}m ago</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

---

## 14. Pages — Market Detail

### `app/markets/[identifier]/page.tsx`

```tsx
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { MarketHeader } from '@/components/market/MarketHeader';
import { RatchetStatusBar } from '@/components/market/RatchetStatusBar';
import { DualChart } from '@/components/market/DualChart';
import { ChartTimeRangeTabs } from '@/components/market/ChartTimeRangeTabs';
import { TradePanel } from '@/components/market/TradePanel';
import { HoldersTable } from '@/components/market/HoldersTable';
import { TradesTable } from '@/components/market/TradesTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { serverApi } from '@/lib/api';

interface PageProps {
  params: { identifier: string };
}

export async function generateMetadata({ params }: PageProps) {
  const identifier = decodeURIComponent(params.identifier);
  return {
    title: `${identifier.replace('xyz:', '')} — Tredie`,
  };
}

export default async function MarketPage({ params }: PageProps) {
  const identifier = decodeURIComponent(params.identifier);
  const detail = await serverApi.getMarketDetail(identifier).catch(() => null);

  if (!detail) {
    // Market may not exist yet — show "Create market" prompt
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-20 text-center">
        <h1 className="text-[#FAFAFA] font-mono text-2xl mb-3">{identifier}</h1>
        <p className="text-white/40 font-sans mb-6">No market found for this identifier.</p>
        <p className="text-white/25 text-sm font-mono">
          Search for it on the homepage to create one automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="flex gap-6">
        {/* Left column 65% */}
        <div className="flex-[0_0_65%] min-w-0">
          <MarketHeader market={detail.market} />
          <RatchetStatusBar market={detail.market} />

          {/* Chart */}
          <div className="bg-white/[0.04] border border-white/[0.07] rounded-[12px] p-4 mb-5">
            <Suspense fallback={<Skeleton className="h-72" />}>
              <ChartSection marketPda={detail.market.pda} />
            </Suspense>
          </div>

          {/* Holders + Trades tabs */}
          <BottomTabs trades={detail.recentTrades} />
        </div>

        {/* Right column 35% */}
        <div className="flex-[0_0_35%] min-w-0">
          <TradePanel market={detail.market} />
        </div>
      </div>
    </div>
  );
}

// Client component wrapper for chart (needs interactivity)
import MarketChartClient from './MarketChartClient';

async function ChartSection({ marketPda }: { marketPda: string }) {
  return <MarketChartClient marketPda={marketPda} />;
}

function BottomTabs({ trades }: { trades: any[] }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.07] rounded-[12px] p-4">
      <div className="flex border-b border-white/[0.07] mb-4">
        {['Holders', 'Trades'].map((t) => (
          <button key={t} className="px-4 py-2 text-sm font-sans text-white/60 hover:text-white first:text-[#FAFAFA]">
            {t}
          </button>
        ))}
      </div>
      <TradesTable trades={trades} />
    </div>
  );
}
```

### `app/markets/[identifier]/MarketChartClient.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { DualChart } from '@/components/market/DualChart';
import { ChartTimeRangeTabs } from '@/components/market/ChartTimeRangeTabs';
import { Skeleton } from '@/components/ui/Skeleton';

type Range = '1H' | '6H' | '24H' | '1W' | 'ALL';

export default function MarketChartClient({ marketPda }: { marketPda: string }) {
  const [range, setRange] = useState<Range>('24H');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/markets/${marketPda}/chart?range=${range}`)
      .then(r => r.json())
      .then(d => setData(d.points || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [marketPda, range]);

  return (
    <>
      <ChartTimeRangeTabs active={range} onChange={setRange} />
      <div className="mt-4">
        {loading ? <Skeleton className="h-72" /> : <DualChart data={data} />}
      </div>
    </>
  );
}
```

---

## 15. Wallet Components

### `components/wallet/ConnectModal.tsx`

```tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { X } from 'lucide-react';

interface Props { isOpen: boolean; onClose: () => void; }

export function ConnectModal({ isOpen, onClose }: Props) {
  const { login } = usePrivy();

  if (!isOpen) return null;

  function handleLogin() {
    login();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111113] border border-white/[0.10] rounded-[16px] w-full max-w-[380px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[#FAFAFA] text-lg font-sans font-semibold">Connect to Tredie</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email / Google — via Privy */}
        <div className="space-y-2 mb-4">
          <button
            onClick={handleLogin}
            className="w-full h-11 flex items-center gap-3 px-4 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-lg text-[#FAFAFA] text-sm font-sans transition-colors"
          >
            <span className="text-lg">@</span>
            Continue with Email
          </button>
          <button
            onClick={handleLogin}
            className="w-full h-11 flex items-center gap-3 px-4 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-lg text-[#FAFAFA] text-sm font-sans transition-colors"
          >
            <span className="text-lg">G</span>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-white/25 text-xs font-mono">or</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        {/* External wallets — Privy handles the selection */}
        <div className="space-y-2">
          {['Phantom', 'Solflare', 'Other wallets...'].map((wallet) => (
            <button
              key={wallet}
              onClick={handleLogin}
              className="w-full h-11 flex items-center gap-3 px-4 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-lg text-[#FAFAFA] text-sm font-sans transition-colors"
            >
              <span className="w-5 h-5 rounded-full bg-white/[0.10]" />
              {wallet}
            </button>
          ))}
        </div>

        <p className="text-white/20 text-[11px] font-sans text-center mt-5">
          By connecting you agree to Terms of Service
        </p>
      </div>
    </div>
  );
}
```

### `components/wallet/DepositModal.tsx`

```tsx
'use client';

import { useSolanaWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode.react';

interface Props { isOpen: boolean; onClose: () => void; }

export function DepositModal({ isOpen, onClose }: Props) {
  const { wallets } = useSolanaWallets();
  const [copied, setCopied] = useState(false);

  const address = wallets[0]?.address;
  if (!isOpen || !address) return null;

  function copyAddress() {
    navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111113] border border-white/[0.10] rounded-[16px] w-full max-w-[360px] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#FAFAFA] text-lg font-sans font-semibold">Deposit SOL</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR code */}
        <div className="bg-white rounded-xl p-4 flex justify-center mb-4">
          <QRCode value={address} size={192} />
        </div>

        {/* Address */}
        <p className="text-white/40 text-xs font-sans mb-2">Solana wallet address</p>
        <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2.5 mb-4">
          <span className="text-[#FAFAFA] font-mono text-sm flex-1 truncate">{address}</span>
          <button onClick={copyAddress} className="text-white/40 hover:text-white shrink-0 transition-colors">
            {copied ? <Check className="w-4 h-4 text-[#22C55E]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-white/25 text-[11px] font-sans text-center">
          Only deposit SOL on Solana devnet. Do not send mainnet tokens.
        </p>
      </div>
    </div>
  );
}
```

### `components/wallet/PortfolioDropdown.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import Link from 'next/link';
import { formatCompact } from '@/lib/format';
import { DepositModal } from './DepositModal';
import { api } from '@/lib/api';

interface Props { onClose: () => void; }

export function PortfolioDropdown({ onClose }: Props) {
  const { user, logout } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const address = wallets[0]?.address;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    if (!address) return;
    fetch(`/api/v1/users/${address}/balance`)
      .then(r => r.json())
      .then(d => setBalanceLamports(d.lamports))
      .catch(() => setBalanceLamports(null));
  }, [address]);

  const solBalance = balanceLamports != null ? balanceLamports / 1e9 : null;

  return (
    <>
      <div
        ref={ref}
        className="absolute top-full right-0 mt-2 w-64 bg-[#111113] border border-white/[0.10] rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn"
      >
        {/* Wallet info */}
        {address && (
          <div className="p-4 border-b border-white/[0.07]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/40 text-xs font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
              <button
                onClick={() => { setShowDeposit(true); onClose(); }}
                className="text-[#A855F7] text-xs font-mono hover:text-[#C084FC]"
              >
                Deposit
              </button>
            </div>
            <div className="text-[#FAFAFA] font-mono text-lg">
              {solBalance != null ? `${solBalance.toFixed(3)} SOL` : '— SOL'}
            </div>
            <div className="text-white/25 text-[11px] font-sans">Devnet balance</div>
          </div>
        )}

        {/* Nav links */}
        <div className="p-2">
          {[
            { href: '/portfolio', label: 'Portfolio' },
            { href: '/my-trends', label: 'My Trends' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center h-9 px-3 text-sm font-sans text-white/60 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <button
            onClick={() => { logout(); onClose(); }}
            className="w-full text-left flex items-center h-9 px-3 text-sm font-sans text-[#EF4444]/70 hover:text-[#EF4444] hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      <DepositModal isOpen={showDeposit} onClose={() => setShowDeposit(false)} />
    </>
  );
}
```


---

## 16. Zustand Stores

### `store/markets.ts`

```typescript
import { create } from 'zustand';
import type { MarketRow, MarketDetail } from '@/lib/api';

interface MarketsState {
  markets: MarketRow[];
  activeMarket: MarketDetail | null;
  loading: boolean;
  setMarkets: (markets: MarketRow[]) => void;
  setActiveMarket: (market: MarketDetail | null) => void;
  setLoading: (v: boolean) => void;
  updateMarket: (pda: string, updates: Partial<MarketRow>) => void;
}

export const useMarketsStore = create<MarketsState>((set) => ({
  markets: [],
  activeMarket: null,
  loading: false,
  setMarkets: (markets) => set({ markets }),
  setActiveMarket: (activeMarket) => set({ activeMarket }),
  setLoading: (loading) => set({ loading }),
  updateMarket: (pda, updates) =>
    set((state) => ({
      markets: state.markets.map((m) => m.pda === pda ? { ...m, ...updates } : m),
    })),
}));
```

### `store/wallet.ts`

```typescript
import { create } from 'zustand';

interface WalletState {
  address: string | null;
  balanceLamports: number | null;
  isEmbedded: boolean;
  setAddress: (addr: string | null) => void;
  setBalance: (lamports: number | null) => void;
  setIsEmbedded: (v: boolean) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  balanceLamports: null,
  isEmbedded: false,
  setAddress: (address) => set({ address }),
  setBalance: (balanceLamports) => set({ balanceLamports }),
  setIsEmbedded: (isEmbedded) => set({ isEmbedded }),
}));
```

### `store/trade.ts`

```typescript
import { create } from 'zustand';

interface TradeState {
  side: 'buy' | 'sell';
  amount: string;
  slippageBps: number;
  estimatedOut: number | null;
  txStatus: 'idle' | 'signing' | 'sending' | 'confirmed' | 'error';
  txSignature: string | null;
  txError: string | null;
  setSide: (side: 'buy' | 'sell') => void;
  setAmount: (amount: string) => void;
  setSlippage: (bps: number) => void;
  setEstimatedOut: (v: number | null) => void;
  setTxStatus: (s: TradeState['txStatus']) => void;
  setTxSignature: (sig: string | null) => void;
  setTxError: (err: string | null) => void;
  reset: () => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  side: 'buy',
  amount: '',
  slippageBps: 500,
  estimatedOut: null,
  txStatus: 'idle',
  txSignature: null,
  txError: null,
  setSide: (side) => set({ side }),
  setAmount: (amount) => set({ amount }),
  setSlippage: (slippageBps) => set({ slippageBps }),
  setEstimatedOut: (estimatedOut) => set({ estimatedOut }),
  setTxStatus: (txStatus) => set({ txStatus }),
  setTxSignature: (txSignature) => set({ txSignature }),
  setTxError: (txError) => set({ txError }),
  reset: () => set({ amount: '', estimatedOut: null, txStatus: 'idle', txSignature: null, txError: null }),
}));
```

---

## 17. Lib Utilities

### `lib/api.ts`

```typescript
import ky from 'ky';

const BASE = '/api/v1';

export interface MarketRow {
  pda: string;
  mint: string;
  identifier: string;
  asset_class: number;
  display_name: string | null;
  image_url: string | null;
  source_url: string | null;
  base_virtual_sol: number;
  virtual_token_supply: number;
  real_sol_reserves: number;
  tokens_minted: number;
  current_mindshare_bps: number;
  peak_mindshare_bps: number;
  ratchet_multiplier_bps: number;
  creator_pubkey: string;
  created_at: number;
}

export interface MarketDetail {
  market: MarketRow;
  mindshareHistory: MindsharePoint[];
  recentTrades: Trade[];
  autoEvents: AutoEvent[];
}

export interface MindsharePoint {
  recorded_at: number;
  current_bps: number;
  peak_bps: number;
  ratchet_bps: number;
}

export interface Trade {
  signature: string;
  side: 0 | 1;
  trader: string;
  sol_amount: number;
  token_amount: number;
  ratchet_bps: number;
  block_time: number;
  slot: number;
}

export interface AutoEvent {
  event_id: string;
  query_id: string;
  received_at: number;
}

export interface SearchSuggestion {
  type: 'symbol' | 'ca' | 'link';
  value: string;
  display: string;
}

// Client-side API (used in Client Components)
export const api = {
  async getMarkets(params?: {
    assetClass?: number;
    limit?: number;
    sortBy?: 'mindshare' | 'volume' | 'recent';
  }): Promise<MarketRow[]> {
    const search = new URLSearchParams();
    if (params?.assetClass != null) search.set('assetClass', String(params.assetClass));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.sortBy) search.set('sortBy', params.sortBy);
    const data = await ky.get(`${BASE}/markets?${search}`).json<{ markets: MarketRow[] }>();
    return data.markets;
  },

  async getMarketDetail(identifier: string): Promise<MarketDetail> {
    return ky.get(`${BASE}/markets/${encodeURIComponent(identifier)}`).json<MarketDetail>();
  },

  async search(q: string): Promise<SearchSuggestion[]> {
    const data = await ky.get(`${BASE}/search?q=${encodeURIComponent(q)}`).json<{ suggestions: SearchSuggestion[] }>();
    return data.suggestions;
  },

  async resolveLink(url: string) {
    return ky.post(`${BASE}/resolve-link`, { json: { url } }).json<{
      metadata: any;
      extractedSymbol: string | null;
      confidence: 'high' | 'medium' | 'low';
      suggestedMarketPath: string | null;
    }>();
  },

  async prepareTrade(params: {
    identifier: string;
    side: 'buy' | 'sell';
    amount: number;
    slippageBps: number;
    trader: string;
  }) {
    return ky.post(`${BASE}/markets/prepare-trade`, { json: params }).json<{ transaction: string }>();
  },

  async getTrendingTokens() {
    return ky.get(`${BASE}/trending/tokens`).json<{ tokens: any[] }>();
  },

  async getTrendingCAs(platform: 'twitter' | 'telegram') {
    return ky.get(`${BASE}/trending/cas/${platform}`).json<{ cas: any[] }>();
  },
};

// Server-side API (used in Server Components — direct fetch, no rewrite needed)
export const serverApi = {
  async getMarketDetail(identifier: string): Promise<MarketDetail> {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const res = await fetch(`${backendUrl}/api/v1/markets/${encodeURIComponent(identifier)}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) throw new Error('Market not found');
    return res.json();
  },
};
```

### `lib/format.ts`

```typescript
// Price from bonding curve state (approximate USD via SOL price)
export function formatPrice(realSolReserves: number, tokensMinted: number): string {
  if (!tokensMinted) return '$0.00';
  const solPrice = 150; // TODO: fetch real price
  const virtualSol = 30e9; // DEFAULT_BASE_VIRTUAL_SOL in lamports
  const effectiveSol = (virtualSol + realSolReserves) / 1e9;
  const pricePerToken = (effectiveSol * solPrice) / (1_000_000_000 - tokensMinted / 1e6);
  return pricePerToken < 0.01
    ? `$${pricePerToken.toExponential(2)}`
    : `$${pricePerToken.toFixed(4)}`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function formatPct(pct: number): string {
  return `${Math.abs(pct).toFixed(1)}%`;
}

export function formatSol(lamports: number): string {
  return `${(lamports / 1e9).toFixed(3)} SOL`;
}

export function formatAge(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}
```

### `lib/platform-detect.ts`

```typescript
export type Platform = 'twitter' | 'tiktok' | 'youtube' | 'instagram' | 'unknown';

export function detectPlatform(url: string): Platform {
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/instagram\.com/i.test(url)) return 'instagram';
  return 'unknown';
}

export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export function isSolanaCA(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
}
```

### `lib/solana.ts`

```typescript
import { Connection, PublicKey } from '@solana/web3.js';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC!,
      'confirmed'
    );
  }
  return _connection;
}

export function getProgramId(): PublicKey {
  return new PublicKey(process.env.NEXT_PUBLIC_TREDIE_PROGRAM_ID!);
}

// Derive market PDA (must match on-chain seeds)
export function deriveMarketPda(identifier: string): PublicKey {
  const identifierBytes = Buffer.alloc(32);
  const encoded = Buffer.from(identifier, 'utf8');
  encoded.copy(identifierBytes, 0, 0, Math.min(encoded.length, 32));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('market'), identifierBytes],
    getProgramId()
  );
  return pda;
}
```

### `lib/privy.ts`

```typescript
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';

// Hook: get the best available wallet (embedded preferred)
export function useActiveWallet() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useSolanaWallets();

  if (!authenticated) return null;

  // Privy embedded wallet is always wallets[0] for email/social users
  // External wallet (Phantom etc.) shows up if connected
  return wallets[0] ?? null;
}

// Hook: check if current user has an embedded wallet (vs external only)
export function useIsEmbeddedUser() {
  const { user } = usePrivy();
  return !!(user?.linkedAccounts?.find((a: any) => a.type === 'wallet' && a.walletClient === 'privy'));
}
```

---

## 18. Trade Flow (Complete)

Alur lengkap dari user klik Buy sampai transaksi confirmed.

```
User input amount
      ↓
TradePanel.handleSubmit()
      ↓
[1] Check: authenticated? → if not → privy.login()
      ↓
[2] POST /api/v1/markets/prepare-trade
    Body: { identifier, side, amount, slippageBps, trader }
    Backend:
      - validates market exists
      - fetches oracle ratchet_multiplier_bps
      - builds create_market ix IF market doesn't exist on-chain yet
      - builds buy/sell ix
      - serializes unsigned tx (base64)
    Response: { transaction: base64String }
      ↓
[3] Frontend: Transaction.from(Buffer.from(txBase64, 'base64'))
      ↓
[4] wallet.signTransaction(tx)
    - Embedded wallet: Privy signs transparently (no popup for small amounts)
    - External wallet: Phantom/Solflare shows approval popup
      ↓
[5] conn.sendRawTransaction(signedTx.serialize())
      ↓
[6] conn.confirmTransaction(sig, 'confirmed')
      ↓
[7] Show success toast + link to Solscan
    Backend Helius webhook picks up tx → updates markets table
```

### Backend endpoint yang dibutuhkan: `POST /api/v1/markets/prepare-trade`

```typescript
// backend/src/api/markets.ts (tambahkan)
router.post('/markets/prepare-trade', async (req, res) => {
  const { identifier, side, amount, slippageBps, trader } = req.body;

  // 1. Check/create market on-chain
  const market = await db.getMarketByIdentifier(identifier);
  if (!market) {
    await marketSpawner.ensureMarket({ identifier, assetClass: detectAssetClass(identifier), source: 'user_search' });
  }

  // 2. Build tx
  const oracle = await db.getOracleForMarket(market.pda);
  const tx = side === 'buy'
    ? await buildBuyTx({ market, oracle, solAmount: Math.floor(amount * 1e9), minTokensOut: 0, slippageBps, trader })
    : await buildSellTx({ market, oracle, tokenAmount: Math.floor(amount), minSolOut: 0, slippageBps, trader });

  // 3. Serialize
  const serialized = tx.serialize({ requireAllSignatures: false });
  res.json({ transaction: Buffer.from(serialized).toString('base64') });
});
```

### Backend endpoint: `POST /api/v1/markets/estimate`

```typescript
router.post('/markets/estimate', async (req, res) => {
  const { identifier, side, amount, slippageBps } = req.body;
  const market = await db.getMarketByIdentifier(identifier);
  if (!market) return res.json({ tokensOut: 0, solOut: 0 });

  const oracle = await db.getOracleForMarket(market.pda);
  const ratchet = oracle?.ratchet_multiplier_bps ?? 10000;

  const effectiveVirtualSol = BigInt(market.base_virtual_sol) * BigInt(ratchet) / 10000n;
  const currentSol = effectiveVirtualSol + BigInt(market.real_sol_reserves);
  const currentTokens = BigInt(market.virtual_token_supply) - BigInt(market.tokens_minted);
  const k = currentSol * currentTokens;

  if (side === 'buy') {
    const fee = BigInt(Math.floor(amount * 1e9)) * 100n / 10000n;
    const solIn = BigInt(Math.floor(amount * 1e9)) - fee;
    const newSol = currentSol + solIn;
    const newTokens = k / newSol;
    const tokensOut = Number(currentTokens - newTokens) / 1e6;
    res.json({ tokensOut: tokensOut.toFixed(0) });
  } else {
    const tokensBurn = BigInt(Math.floor(amount));
    const newTokens = currentTokens + tokensBurn;
    const newSol = k / newTokens;
    const solOut = Number(currentSol - newSol) / 1e9;
    res.json({ solOut: solOut.toFixed(4) });
  }
});
```

---

## 19. Phase Build Order

### Phase 1 — Scaffold & Auth (1-2 jam)

**Tasks:**
1. `bunx create-next-app@latest frontend` dengan flags di Section 3
2. Install semua dependencies
3. Setup `tailwind.config.ts` dengan color system dari Section 6
4. Setup `app/globals.css`
5. Setup `app/providers.tsx` dengan Privy config (App ID dari Predica)
6. Setup `app/layout.tsx` dengan font loading
7. Buat `components/header/Header.tsx` — static dulu (tanpa wallet state)
8. Buat `components/ui/Button.tsx`, `Skeleton.tsx`, `Spinner.tsx`

**Acceptance:**
- `bun run dev` berhasil, halaman tampil dengan warna `#09090B`
- Header muncul dengan logo "Tredie" dan tombol Connect
- Klik Connect → Privy modal muncul
- Login dengan email → embedded wallet dibuat, header berubah jadi alamat wallet
- Login dengan Phantom → external wallet connected

---

### Phase 2 — Discovery Feed (2-3 jam)

**Tasks:**
1. Backend harus running (`bun run dev` di folder backend)
2. Buat `lib/api.ts` dengan `api.getMarkets()`
3. Buat `components/discovery/` semua files (DiscoveryTabs, TokenSubTabs, AssetClassFilter, MarketGrid, MarketCard, CACard, RatchetBadge)
4. Buat `app/page.tsx` dengan state management
5. Buat `lib/format.ts`
6. Test: buka homepage → market cards tampil dari backend

**Acceptance:**
- Grid 4 kolom tampil dengan data dari backend
- Filter asset class works
- Sub-tabs beralih antara Trending/X/TG
- Card hover state muncul border purple
- Ratchet badge warna sesuai multiplier (gray/purple/bright/fuchsia)

---

### Phase 3 — Market Detail Page (3-4 jam)

**Tasks:**
1. Buat `app/markets/[identifier]/page.tsx` (Server Component)
2. Buat `app/markets/[identifier]/MarketChartClient.tsx` (Client Component)
3. Buat semua komponen di `components/market/`:
   - MarketHeader, RatchetStatusBar, DualChart, ChartTimeRangeTabs
   - HoldersTable, TradesTable
4. Setup `store/trade.ts`
5. Buat `lib/solana.ts`
6. Backend endpoint `/api/v1/markets/:identifier` harus return data lengkap

**Acceptance:**
- Click card di homepage → navigate ke `/markets/BONK`
- Market header tampil dengan price, ratchet badge
- RatchetStatusBar tampil dengan progress
- DualChart tampil (bisa kosong jika belum ada data)
- Tab Holders dan Trades tampil

---

### Phase 4 — Trade Flow (3-4 jam)

**Tasks:**
1. Buat `components/market/TradePanel.tsx` (full version dari Section 13)
2. Backend endpoint `POST /api/v1/markets/prepare-trade` (lihat Section 18)
3. Backend endpoint `POST /api/v1/markets/estimate`
4. Buat `lib/privy.ts` helpers
5. Test full flow: Connect → input amount → Buy → sign → confirm

**Acceptance:**
- Buy flow works end-to-end (devnet)
- Slippage 5% default
- Error states tampil (insufficient balance, slippage exceeded)
- Success state shows Solscan link
- Sell flow juga works

---

### Phase 5 — Wallet Components (1-2 jam)

**Tasks:**
1. `components/wallet/ConnectModal.tsx`
2. `components/wallet/DepositModal.tsx` dengan QR code
3. `components/wallet/PortfolioDropdown.tsx`
4. `PortfolioButton.tsx` di header

**Acceptance:**
- Deposit modal tampil QR code dengan alamat wallet
- Portfolio dropdown tampil SOL balance
- Disconnect berhasil

---

### Phase 6 — Search Bar + Link Flow (2-3 jam)

**Tasks:**
1. `components/header/SearchBar.tsx` (full version dari Section 10)
2. `lib/platform-detect.ts`
3. Backend `GET /api/v1/search?q=`
4. Backend `POST /api/v1/resolve-link`
5. Test: paste Twitter URL → resolve → navigate ke market

**Acceptance:**
- Search autocomplete tampil dalam 200ms
- Paste URL → "Resolve link..." option muncul
- Link resolve berhasil extract ticker → navigate ke market

---

### Phase 7 — Polish & Data Seeding (2-3 jam)

**Tasks:**
1. Loading skeletons di semua async states
2. Empty states
3. Error boundaries
4. `app/portfolio/page.tsx` — holdings list
5. `app/my-trends/page.tsx` — user-created markets
6. Seed 8-12 markets via backend scripts sebelum demo
7. Test full demo flow tanpa bug

**Acceptance:**
- Non-technical user bisa signup → deposit → trade → lihat portfolio
- Tidak ada error console yang visible di browser
- Chart tampil data real dari 24-48 jam sebelum demo

---

## 20. Common Pitfalls

### 1. Privy wallet signTransaction — hanya untuk Anchor-built tx

```typescript
// ✅ Benar: serialize tx dari backend (unsigned), sign di frontend
const tx = Transaction.from(Buffer.from(txBase64, 'base64'));
const signed = await wallet.signTransaction(tx);

// ❌ Salah: jangan buat tx dari scratch di frontend tanpa blockhash
const tx = new Transaction().add(instruction); // missing blockhash!
```

### 2. `recentBlockhash` wajib diset backend sebelum serialize

```typescript
// Di backend (instructions.ts):
const { blockhash } = await connection.getLatestBlockhash();
tx.recentBlockhash = blockhash;
tx.feePayer = new PublicKey(trader);
// Serialize tanpa signing
const serialized = tx.serialize({ requireAllSignatures: false });
```

### 3. Font loading — JetBrains Mono self-host

```typescript
// Kalau Google Font CDN lambat, self-host:
// 1. Download dari fonts.google.com (Variable font .woff2)
// 2. Taruh di public/fonts/JetBrainsMono-Variable.woff2
// 3. Gunakan localFont di layout.tsx (sudah ada di Section 8)

// ❌ Jangan: import font di globals.css via @import url()
// @import url('https://fonts.googleapis.com/...') → blocked di beberapa browser
```

### 4. Tailwind 4.x — tidak perlu `@tailwind` directives

```css
/* ✅ Tailwind 4.x */
@import "tailwindcss";

/* ❌ Tailwind 3.x syntax (jangan pakai di Tailwind 4) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 5. Server Component vs Client Component

```typescript
// app/markets/[identifier]/page.tsx → Server Component (default)
// Bisa fetch langsung tanpa useEffect
const detail = await serverApi.getMarketDetail(identifier);

// components/market/TradePanel.tsx → wajib 'use client' karena:
// - useState, useEffect
// - usePrivy(), useSolanaWallets()
// - event handlers (onClick, onChange)

// Jangan taruh 'use client' di layout.tsx atau page.tsx kecuali perlu
```

### 6. Identifier encoding di URL

```typescript
// Identifier bisa mengandung ':' (xyz:NVDA) dan '/' yang harus di-encode
// ✅ Benar:
router.push(`/markets/${encodeURIComponent('xyz:NVDA')}`);
// URL: /markets/xyz%3ANVDA

// Di page.tsx:
const identifier = decodeURIComponent(params.identifier);
// → 'xyz:NVDA'

// ✅ Benar: di fetch ke backend
fetch(`/api/v1/markets/${encodeURIComponent(identifier)}`)
```

### 7. Recharts SSR issue

```typescript
// DualChart harus dalam Client Component karena Recharts tidak support SSR
// Cara: wrap dalam Suspense + Client Component (sudah dilakukan di Section 14)

// ❌ Jangan: import Recharts langsung di Server Component
// import { ComposedChart } from 'recharts'; // akan error di build
```

### 8. Mindshare bps ke persentase

```typescript
// Elfa returns mindshare_pct (0.0250 = 2.5%)
// Disimpan di DB sebagai bps (2500)
// Di frontend:
const pct = market.current_mindshare_bps / 100; // → 25.0 (%)
const display = `${pct.toFixed(1)}%`; // → "25.0%"

// Jangan: (bps / 10000) → itu untuk ratchet multiplier, bukan mindshare %
const ratchet = market.ratchet_multiplier_bps / 10000; // → 2.5×
```

### 9. Slippage default 5%, bukan 1%

```typescript
// Market baru memiliki likuiditas rendah → spread lebar
// Default slippage 1% sering gagal → pakai 5% (500 bps)
const [slippage] = useState(500); // ✅ 5% default

// Biarkan user ubah lewat settings kalau mau
```

### 10. Next.js rewrites — prefix `/api/v1`

```typescript
// next.config.ts sudah setup rewrite:
// /api/v1/* → http://localhost:4000/api/v1/*

// Di frontend: SELALU gunakan /api/v1/... (tanpa domain)
fetch('/api/v1/markets') // ✅

// JANGAN: hardcode backend URL di client components
fetch('http://localhost:4000/api/v1/markets') // ❌ CORS issue di production
```

### 11. Image dari on-chain metadata — validate domain

```typescript
// next.config.ts sudah memiliki remotePatterns untuk Helius, Arweave, Twitter
// Jika ada domain baru yang error, tambahkan ke remotePatterns

// Gunakan next/image untuk semua market icon:
<Image src={market.image_url} alt="" width={32} height={32} />

// Jika image_url null, tampilkan fallback div dengan inisial
{market.image_url ? <Image ... /> : <div className="...">AB</div>}
```

### 12. QRCode import

```typescript
// Package: qrcode.react
// ✅ Correct import:
import QRCode from 'qrcode.react';

// Hanya bisa dipakai di Client Component ('use client')
// Jika error TypeScript: bun add -d @types/qrcode.react
```

---

## Appendix — Quick Reference

### Warna yang paling sering dipakai

```
bg-[#09090B]                    ← background halaman
bg-white/[0.04]                 ← card surface
border border-white/[0.07]      ← card border
text-[#FAFAFA]                  ← teks utama
text-white/40                   ← label muted
font-mono                       ← semua angka
bg-[#A855F7]                    ← CTA button
text-[#A855F7]                  ← link / active
text-[#22C55E]                  ← buy / positive
text-[#EF4444]                  ← sell / negative
```

### Breakpoints

Desktop-first. Mobile diselesaikan nanti (Phase 8).

```
sm:  640px   → tidak dipakai dulu
md:  768px   → tidak dipakai dulu
lg:  1024px  → tablet landscape
xl:  1280px  → target minimum
2xl: 1536px  → target optimal (1440px)
```

Layout market detail (desktop): `flex-[0_0_65%]` kiri + `flex-[0_0_35%]` kanan.

### Development checklist sebelum demo

- [ ] `bun run type-check` — 0 TypeScript errors
- [ ] Homepage load < 2s
- [ ] Discovery feed tampil minimal 8 market cards
- [ ] Klik card → navigate ke detail (< 1s)
- [ ] Trade flow: buy 0.01 SOL → success
- [ ] Wallet dropdown tampil SOL balance
- [ ] Deposit modal tampil QR code
- [ ] Search: ketik "BONK" → suggestion muncul
- [ ] Search: paste Twitter URL → resolve berhasil
- [ ] Ratchet badge 5× tampil dengan fuchsia glow

---

*Selesai. Last updated: 6 Mei 2026. Backend BUILD.md ada di `backend/BUILD.md`.*



