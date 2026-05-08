import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import PrivyProviderWrapper from "@/components/providers/PrivyProviderWrapper";
import QueryProvider from "@/providers/QueryProvider";

const Font1 = localFont({
  src: [{ path: "./fonts/font1.woff2", weight: "300", style: "normal" }],
  variable: "--font-body",
  display: "swap",
});

const Font2 = localFont({
  src: [{ path: "./fonts/font2.woff2", weight: "400", style: "normal" }],
  variable: "--font-display",
  display: "swap",
});

const Font3 = localFont({
  src: [{ path: "./fonts/font3.woff2", weight: "400", style: "normal" }],
  variable: "--font-third",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tredie — On-Chain Attention Market",
  description: "Trade social attention on crypto, equities, and commodities on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${Font1.variable} ${Font2.variable} ${Font3.variable} antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#09090B] text-[#FAFAFA] font-sans">
        <QueryProvider>
          <PrivyProviderWrapper>
            <AppLayout>{children}</AppLayout>
          </PrivyProviderWrapper>
        </QueryProvider>
      </body>
    </html>
  );
}
