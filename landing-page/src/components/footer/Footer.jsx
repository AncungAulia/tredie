"use client";
import React, { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const Footer = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const animatedPos = useRef({ x: 0, y: 0 });
  const circleRef = useRef(null);
  const containerRef = useRef(null);

  const [hoveredIndex, setHoveredIndex] = useState(null);

  const navItems = [
    { title: "Home", href: "/" },
    { title: "About", href: "/about" },
    { title: "Markets", href: "/markets" },
    { title: "How It Works", href: "/how-it-works" },
    { title: "Trending", href: "/trending" },
    { title: "Portfolio", href: "/portfolio" },
    { title: "Docs", href: "/docs" },
    { title: "Contact", href: "/contact" },
  ];

  const socialItems = [
    { title: "LinkedIn", href: "https://linkedin.com" },
    { title: "Instagram", href: "https://instagram.com" },
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to("#footer-wrapper", {
        yPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: "#footer-wrapper",
          start: "top bottom",
          end: "bottom 50%",
          scrub: true,
          immediateRender: false,
        },
      });
    });
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const containerHeight = containerRef.current.offsetHeight;
      const initialX = containerWidth / 2;
      const initialY = containerHeight * 0.75;
      setMousePos({ x: initialX, y: initialY });
      animatedPos.current = { x: initialX, y: initialY };
    }
  }, []);

  useEffect(() => {
    gsap.to(animatedPos.current, {
      x: mousePos.x,
      y: mousePos.y,
      duration: 0.6,
      ease: "power2.out",
      onUpdate: () => {
        if (circleRef.current && containerRef.current) {
          const containerWidth = containerRef.current.offsetWidth;
          const svgX = (animatedPos.current.x / containerWidth) * 1856;
          circleRef.current.setAttribute("x", svgX - 464);
        }
      },
    });
  }, [mousePos]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      className="h-fit w-full relative z-12 bg-black "
      id="footer-wrapper"
      style={{ transform: "translateY(0%)" }}
    >
      <footer
        ref={containerRef}
        className="w-full h-screen mt-0 pointer-events-auto sticky top-0 bg-[#1E1E1E] flex flex-col items-stretch justify-between p-[2vw]"
        onMouseMove={handleMouseMove}
      >
        {/* TOP SECTION */}
        <div className="w-full h-[60%] bg-[#1E1E1E] flex justify-between items-start text-white">
          <div className="flex flex-col justify-center h-full">
            <h1 className="text-[4vw] font-third leading-[1]">
              Trade the <br /> Attention Economy
            </h1>
            <div className="text-[1vw] leading-[1.6vw] font-light text-gray-300 mt-auto">
              <p>Tredie Fun</p>
              <p>Solana Devnet</p>
              <p>Colosseum Frontier 2026</p>
              <p className="mt-[1vw]">solana.frontier@tredie.xyz</p>
            </div>
          </div>

          {/* RIGHT SIDE MENU WITH ANIMATION */}
          <div className="flex justify-between opacity-90 h-full px-[4vw] w-[30vw]">
            {/* EXPLORE */}
            <div className="flex flex-col">
              <span className="uppercase text-[0.7vw] font-semibold mb-[1vw] tracking-[0.05em]">
                Explore
              </span>
              <ul className="font-display text-[2vw] leading-[1.4vw] space-y-[0.6vw]">
                {navItems.map((item, i) => (
                  <li
                    key={i}
                    className={`leading-none transition-opacity duration-300 ${
                      hoveredIndex !== null && hoveredIndex !== i
                        ? "opacity-50"
                        : "opacity-100"
                    }`}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <Link
                      href={item.href}
                      className=" cursor-pointer transition-colors duration-300 hover:text-[##9C93E8]"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* CONNECT */}
            <div className="flex flex-col">
              <span className="uppercase text-[0.7vw] font-semibold mb-[1vw] tracking-[0.05em]">
                Connect
              </span>
              <ul className="font-display text-[2vw] leading-[1.4vw] space-y-[0.6vw]">
                {socialItems.map((item, i) => (
                  <li key={i}>
                    <Link
                      href={item.href}
                      target="_blank"
                      className=" cursor-pointer transition-colors duration-300 hover:text-[##9C93E8]"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="w-full h-[3vw] text-white/80 flex justify-between ">
          <div className="flex gap-[2vw] items-center">
            <div className="h-[1vw] relative group overflow-hidden cursor-pointer">
              <div
                className="
      w-full h-[2vw]
      transition-none
      group-hover:transition-all group-hover:duration-300
      group-hover:translate-y-[-1vw]
      flex flex-col items-start justify-end
    "
              >
                <span className="text-[0.7vw] uppercase menu-top font-body font-semibold">
                  cookie policy
                </span>

                <span className="text-[0.7vw] uppercase menu-below- font-semibold font-body">
                  Cookie policy{" "}
                </span>
              </div>
            </div>

            <div className="h-[1vw] relative group overflow-hidden cursor-pointer">
              <div
                className="
      w-full h-[2vw]
      transition-none
      group-hover:transition-all group-hover:duration-300
      group-hover:translate-y-[-1vw]
      flex flex-col items-start justify-end
    "
              >
                <span className="text-[0.7vw] uppercase menu-top font-body font-semibold">
                  LEGAL NOTICE & TERMS OF USE
                </span>

                <span className="text-[0.7vw] uppercase menu-below- font-semibold font-body">
                  LEGAL NOTICE & TERMS OF USE
                </span>
              </div>
            </div>

            <div className="h-[1vw] relative group overflow-hidden cursor-pointer">
              <div
                className="
      w-full h-[2vw]
      transition-none
      group-hover:transition-all group-hover:duration-300
      group-hover:translate-y-[-1vw]
      flex flex-col items-start justify-end
    "
              >
                <span className="text-[0.7vw] uppercase menu-top font-body font-semibold">
                  privacy policy
                </span>

                <span className="text-[0.7vw] uppercase menu-below- font-semibold font-body">
                  privacy policy
                </span>
              </div>
            </div>
          </div>

          <div className="items-center flex pr-[5vw]">
            <span className="text-[0.7vw] uppercase menu-top font-body font-semibold">
              copyright @tredie 2026
            </span>
          </div>
        </div>

        {/* BOTTOM SVG SECTION */}
        <div className="relative w-full h-[27%] bg-[#1E1E1E] overflow-hidden">
          {/* BASE SVG */}
          <svg
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            viewBox="0 0 1856 266"
            className="absolute inset-0 object-contain w-full h-full"
          >
            <text
              x="928"
              y="230"
              textAnchor="middle"
              fontFamily="Arial, Helvetica, sans-serif"
              fontSize="248"
              fontWeight="800"
              fill="#1E1E1E"
              letterSpacing="120"
            >
              TREDIE
            </text>
          </svg>

          {/* MASKED SVG */}
          <svg
            preserveAspectRatio="none"
            width="100%"
            height="100%"
            viewBox="0 0 1856 266"
            className="absolute inset-0"
          >
            <defs>
              <linearGradient
                id="fadeGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="white" stopOpacity="0" />
                <stop offset="10%" stopColor="white" stopOpacity="0.3" />
                <stop offset="50%" stopColor="white" stopOpacity="1" />
                <stop offset="90%" stopColor="white" stopOpacity="0.3" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id="cursorMask">
                <rect width="100%" height="100%" fill="black" />
                <rect
                  ref={circleRef}
                  x="528"
                  y="0"
                  width="1300"
                  height="266"
                  fill="url(#fadeGradient)"
                />
              </mask>
            </defs>
            <g mask="url(#cursorMask)">
              <text
                x="928"
                y="230"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="248"
                fontWeight="800"
                fill="#9C93E8"
                letterSpacing="120"
              >
                TREDIE
              </text>
            </g>
          </svg>
        </div>
      </footer>
    </div>
  );
};

export default Footer;
