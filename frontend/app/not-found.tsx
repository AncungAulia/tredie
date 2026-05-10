"use client";
import { motion } from "motion/react";
import Link from "next/link";


const chartData = [44, 47, 45, 50, 48, 46, 49, 47, 44, 41, 36, 29, 21, 15, 11, 9, 8, 8, 8, 8, 8];

function FlatlineChart() {
  const W = 360;
  const H = 64;
  const max = Math.max(...chartData);
  const min = Math.min(...chartData);
  const range = max - min || 1;
  const step = W / (chartData.length - 1);

  const coords = chartData.map((val, i) => ({
    x: parseFloat((i * step).toFixed(2)),
    y: parseFloat((H - ((val - min) / range) * (H - 10) - 5).toFixed(2)),
  }));

  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const fillPath = `${linePath} L${W},${H} L0,${H} Z`;
  const lastPoint = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[320px] h-16"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="grad-404-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </linearGradient>
      </defs>

      <motion.path
        d={fillPath}
        fill="url(#grad-404-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.8 }}
      />

      <motion.path
        d={linePath}
        fill="none"
        stroke="#EF4444"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: "easeInOut", delay: 0.4 }}
      />

      <motion.circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="3"
        fill="#EF4444"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.4, delay: 2 }}
      />

      <motion.circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="6"
        fill="none"
        stroke="#EF4444"
        strokeWidth="1"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
        transition={{ duration: 1.2, delay: 2.4, repeat: Infinity, repeatDelay: 1.4 }}
      />
    </svg>
  );
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
} as const;

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center gap-7 max-w-sm w-full text-center"
        >

          {/* 404 */}
          <motion.h1
            variants={fadeUp}
            className="font-display font-bold leading-none select-none"
            style={{
              fontSize: "clamp(96px, 20vw, 144px)",
              background:
                "linear-gradient(160deg, #FAFAFA 30%, rgba(250,250,250,0.2) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            404
          </motion.h1>

          {/* Chart */}
          <motion.div variants={fadeUp} className="w-full flex justify-center">
            <FlatlineChart />
          </motion.div>

          {/* Title */}
          <motion.div variants={fadeUp} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-white/90 font-display tracking-wide">
              Market Not Found
            </h2>
            <p className="text-sm text-white/35 leading-relaxed">
              This page has been liquidated from existence.
              <br />
              The market you&apos;re looking for doesn&apos;t exist.
            </p>
          </motion.div>

          {/* CTA */}
          <motion.div variants={fadeUp}>
            <Link
              href="/topics"
              className="inline-flex items-center gap-2 h-10 px-6 rounded-md bg-[#9C93E8] hover:bg-[#B3ABF0] text-black text-sm font-semibold transition-colors duration-200"
            >
              Back to Markets
            </Link>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
