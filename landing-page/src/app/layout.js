import "./globals.css";
import localFont from "next/font/local";
import LenisSmoothScroll from "@/components/Lenis/LenisScroll";
import PageTransition from "@/components/page-transition/PageTransition";
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

export const metadata = {
  title: "Tredie",
  description: "Tredie",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${Font1.variable} ${Font2.variable} ${Font3.variable} antialiased`}>
        <LenisSmoothScroll />

     
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
