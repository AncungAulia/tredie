"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitText from "gsap/dist/SplitText";
import ClipPath from "../ClipPath";

gsap.registerPlugin(ScrollTrigger, SplitText);

const Hero = () => {
  const videoRef = useRef(null);
  const clipRef = useRef(null);
  const heroRef = useRef(null);
  const [isFullyScaled, setIsFullyScaled] = useState(false);
  const isMobile = globalThis.innerWidth <= 1024;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      const splitHero = new SplitText(".hero-text", {
        type: "chars,lines",
        linesClass: "lines",
        mask: "lines",
      });

      gsap.set(".ivention-overlay", {
        delay: 0.2,
        opacity: 0,
      });

      tl.from(splitHero.lines, {
        yPercent: 100,
        opacity: 0,
        stagger: 0.2,
        duration: 1,
        delay: 1,
        ease: "power3.out",
      });

      //       gsap.set('.hero-video', {
      //    rotateX: baseRotateX,
      //    rotateY: baseRotateY,
      //  })

      if (!isMobile) {
        gsap.fromTo(
          ".hero-video",
          { rotateX: baseRotateX, rotateY: baseRotateY },
          {
            scale: 3,
            rotateX: 0,
            rotateY: 0,
            ease: "power2.out",
            scrollTrigger: {
              trigger: "#hero",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.8,
              immediateRender: false, // IMPORTANT
              onUpdate: (self) => {
                setIsFullyScaled(self.progress >= 0.9);
              },
            },
          },
        );
      }

      tl.to(
        videoRef.current,
        {
          opacity: 1,
        },
        "-=0.5",
      );
    });
    return () => ctx.revert();
  }, []);

  const baseRotateX = 5;
  const baseRotateY = -5;

  const handleMouseMove = (e) => {
    // Disable mouse effects after video is fully scaled
    if (isFullyScaled) return;

    const video = videoRef.current;
    const clip = clipRef.current;
    const hero = heroRef.current;
    if (!video || !clip || !hero) return;

    const { left, top, width, height } = hero.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    // Normalize mouse position (-1 to 1)
    const normX = (x - width / 2) / (width / 2);
    const normY = (y - height / 2) / (height / 2);

    // Video tilts following the mouse
    const videoRotateY = baseRotateY + normX * 10;
    const videoRotateX = baseRotateX - normY * 10;

    // Clip tilts opposite to mouse movement (anti-direction)
    const clipRotateY = baseRotateY - normX * 15;
    const clipRotateX = baseRotateX + normY * 15;

    gsap.to(video, {
      rotateX: videoRotateX,
      rotateY: videoRotateY,
      // scale: 1.05,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });

    gsap.to(clip, {
      rotateX: clipRotateX,
      rotateY: clipRotateY,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeave = () => {
    // Disable mouse effects after video is fully scaled
    if (isFullyScaled) return;

    const video = videoRef.current;
    const clip = clipRef.current;
    if (video && clip) {
      gsap.to(video, {
        rotateX: baseRotateX,
        rotateY: baseRotateY,
        // scale: 1,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });

      gsap.to(clip, {
        rotateX: baseRotateX,
        rotateY: baseRotateY,
        // scale: 1,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  };

  return (
    <section
      ref={heroRef}
      id="hero"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-screen h-[140vh] max-sm:h-screen bg-black relative  "
    >
      <div className="fixed inset-0 bg-[#9C93E8] pointer-events-none h-full w-full ivention-overlay z-[99999]"></div>

      <div className="h-screen w-full max-sm:w-screen sticky top-0 max-sm:left-0 overflow-hidden flex justify-center items-center">
        <div
          ref={videoRef}
          className="h-[20vw] w-[34vw] border-2 border-[#9C93E8] bg-black max-sm:h-[55vw] max-sm:mx-auto max-sm:w-[90vw] opacity-0 hero-video relative z-40 rounded-[1.5vw] overflow-hidden shadow-2xl origin-cente max-sm:rounded-[3.5vw]"
          style={{
            transformStyle: "preserve-3d",
            transform: `perspective(800px) rotateX(${baseRotateX}deg) rotateY(${baseRotateY}deg)`,
          }}
        >
          <div className="h-full w-full flex flex-col p-[1.2vw] max-sm:p-[4vw] text-[#F3EFEB] relative overflow-hidden">
            {/* ambient glows */}
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[60%] bg-[#9C93E8]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[40%] bg-[#9C93E8]/8 rounded-full blur-2xl pointer-events-none" />

            {/* header row */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col">
                <span className="text-[2.4vw] max-sm:text-[7.5vw] font-third leading-none tracking-tight">
                  ATTENTION
                </span>
              </div>
              <div className="flex items-center gap-[0.35vw] max-sm:gap-[1.2vw] mt-[0.3vw]">
                <span className="w-[0.38vw] h-[0.38vw] max-sm:w-[1.4vw] max-sm:h-[1.4vw] rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[0.5vw] max-sm:text-[1.8vw] text-emerald-400 font-mono tracking-[0.15em] uppercase">
                  live
                </span>
              </div>
            </div>

            {/* price row */}
            <div className="flex items-end justify-between mt-[0.6vw] max-sm:mt-[2vw] relative z-10">
              <div className="flex items-baseline gap-[0.25vw] max-sm:gap-[1vw]">
                <span className="text-[0.65vw] max-sm:text-[2.2vw] text-[#F3EFEB]/40 font-mono self-start mt-[0.5vw] max-sm:mt-[1.5vw]">
                  $
                </span>
                <span className="text-[2.9vw] max-sm:text-[8.5vw] font-mono font-bold leading-none tracking-tighter">
                  0.8421
                </span>
              </div>
              <div className="flex flex-col items-end gap-[0.1vw]">
                <span className="text-[0.45vw] max-sm:text-[1.6vw] text-[#F3EFEB]/35 font-mono uppercase tracking-widest">
                  24h
                </span>
                <span className="text-[0.95vw] max-sm:text-[3.2vw] text-emerald-400 font-mono font-bold">
                  ▲ +14.32%
                </span>
              </div>
            </div>

            {/* divider */}
            <div className="w-full h-px bg-[#9C93E8]/20 my-[0.55vw] max-sm:my-[2vw] relative z-10" />

            {/* sparkline chart */}
            <div className="flex-1 w-full relative z-10 min-h-0">
              <svg
                viewBox="0 0 300 50"
                className="w-full h-full"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                  </linearGradient>
                  <filter
                    id="lineGlow"
                    x="-20%"
                    y="-50%"
                    width="140%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="1.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* area fill */}
                <path
                  d="M0,44 L18,41 L36,43 L54,38 L72,40 L90,33 L108,35 L126,28 L144,31 L162,24 L180,26 L198,19 L216,21 L234,13 L252,15 L270,8 L288,10 L300,5 L300,50 L0,50 Z"
                  fill="url(#sparkFill)"
                />
                {/* line */}
                <path
                  d="M0,44 L18,41 L36,43 L54,38 L72,40 L90,33 L108,35 L126,28 L144,31 L162,24 L180,26 L198,19 L216,21 L234,13 L252,15 L270,8 L288,10 L300,5"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#lineGlow)"
                />
                {/* end dot */}
                <circle
                  cx="300"
                  cy="5"
                  r="2.8"
                  fill="#34d399"
                  filter="url(#lineGlow)"
                />
              </svg>
            </div>

            {/* stats row */}
            <div className="flex justify-between mt-[0.5vw] max-sm:mt-[1.5vw] relative z-10">
              <div>
                <div className="text-[0.42vw] max-sm:text-[1.5vw] text-[#F3EFEB]/30 font-mono uppercase tracking-widest">
                  vol 24h
                </div>
                <div className="text-[0.68vw] max-sm:text-[2.2vw] font-mono text-[#F3EFEB]/75">
                  $2.4M
                </div>
              </div>
              <div className="text-center">
                <div className="text-[0.42vw] max-sm:text-[1.5vw] text-[#F3EFEB]/30 font-mono uppercase tracking-widest">
                  mcap
                </div>
                <div className="text-[0.68vw] max-sm:text-[2.2vw] font-mono text-[#F3EFEB]/75">
                  $12.8M
                </div>
              </div>
              <div className="text-right">
                <div className="text-[0.42vw] max-sm:text-[1.5vw] text-[#F3EFEB]/30 font-mono uppercase tracking-widest">
                  holders
                </div>
                <div className="text-[0.68vw] max-sm:text-[2.2vw] font-mono text-[#F3EFEB]/75">
                  4,821
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* CLIP BACKGROUND LAYER */}
        {/* <div
        ref={clipRef}
        className="absolute left-[-30%] bottom-[-30%] clip-start opacity-0 scale-0 origin-center hero-clip-path w-[155vw] h-[155vh] mix-blend-multiply z-0"
      /> */}
        <ClipPath clipRef={clipRef} />

        {/* TEXT LAYER */}
        <div
          className="absolute inset-0 h-screen w-full flex items-center max-sm:flex-col max-sm:items-start max-sm:justify-between max-sm:pt-[22vw] max-sm:pb-[10vw] text-[#101417] justify-between z-20 px-[3vw] max-sm:px-[5vw]
      "
        >
          <p className="text-[2.5vw] max-sm:text-[10vw] max-sm:text-white font-third leading-[1.1] hero-text max-sm:text-left">
            Trade What the <br /> World Is Talking About
          </p>
          <p className="w-[23%] max-sm:w-full max-sm:text-[4vw] max-sm:leading-[1.5] max-sm:text-left max-sm:opacity-75 max-sm:mb-12 text-[1.3vw] leading-none hero-text text-white">
            Real social mindshare, measured by Elfa AI, traded on-chain.
            Crypto, tokenized equities, commodities. Every attention spike
            permanently raises the price floor. It never comes back down.
          </p>
        </div>

        {/* SVG DECORATION */}
        <div className="absolute bottom-5 max-sm:bottom-0  left-0 w-full h-[25%] max-sm:h-[15%] px-[2vw] ">
          <Image
            width={1000}
            height={1000}
            src="/assets/svg/home-hero.svg"
            alt="text-svg"
            className="absolute bottom-5  max-sm:bottom-[-5vw] left-0 w-full h-full max-sm:px-4 object-contain mix-blend-color-burn opacity-90 z-10"
          />
          <Image
            width={1000}
            height={1000}
            src="/assets/svg/home-hero.svg"
            alt="text-svg"
            className="absolute bottom-5 max-sm:bottom-[-5vw] left-0 w-full h-full max-sm:px-4 object-contain mix-blend-color-burn opacity-90 z-10"
          />
        </div>

        {/* LIGHT OVERLAY */}
        <div className="w-full h-full absolute inset-0 z-15 bg-black/5" />
      </div>
    </section>
  );
};

export default Hero;
