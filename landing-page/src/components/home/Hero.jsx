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
  const videoElRef = useRef(null);
  const cursorRef = useRef(null);
  const clipRef = useRef(null);
  const heroRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isCursorVisible, setIsCursorVisible] = useState(false);
  const isMobile = globalThis.innerWidth <= 1024;

  const isFullyScaled = scrollProgress >= 0.85;
  const controlsOpacity = Math.min(1, Math.max(0, (scrollProgress - 0.65) / 0.2));

  // Track video playback progress
  useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setVideoProgress((video.currentTime / video.duration) * 100);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

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

      if (!isMobile) {
        gsap.fromTo(
          ".hero-video",
          { scale: 1 / 3, rotateX: baseRotateX, rotateY: baseRotateY, borderRadius: "4.5vw" },
          {
            scale: 1,
            rotateX: 0,
            rotateY: 0,
            borderRadius: "0vw",
            ease: "power2.out",
            scrollTrigger: {
              trigger: "#hero",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.3,
              immediateRender: false,
              onUpdate: (self) => {
                setScrollProgress(self.progress);
              },
            },
          },
        );
      }

      tl.to(videoRef.current, { opacity: 1 }, "-=0.5");
    });
    return () => ctx.revert();
  }, []);

  const baseRotateX = 5;
  const baseRotateY = -5;

  const togglePlayPause = () => {
    const video = videoElRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const toggleMute = () => {
    const video = videoElRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleProgressClick = (e) => {
    const video = videoElRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * video.duration;
  };

  // Custom cursor follows mouse when video is fullscreen
  const handleCursorMove = (e) => {
    if (!cursorRef.current) return;
    gsap.to(cursorRef.current, {
      x: e.clientX,
      y: e.clientY,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseMove = (e) => {
    if (isFullyScaled) return;

    const video = videoRef.current;
    const clip = clipRef.current;
    const hero = heroRef.current;
    if (!video || !clip || !hero) return;

    const { left, top, width, height } = hero.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    const normX = (x - width / 2) / (width / 2);
    const normY = (y - height / 2) / (height / 2);

    gsap.to(video, {
      rotateX: baseRotateX - normY * 10,
      rotateY: baseRotateY + normX * 10,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });

    gsap.to(clip, {
      rotateX: baseRotateX + normY * 15,
      rotateY: baseRotateY - normX * 15,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeave = () => {
    if (isFullyScaled) return;

    const video = videoRef.current;
    const clip = clipRef.current;
    if (video && clip) {
      gsap.to(video, {
        rotateX: baseRotateX,
        rotateY: baseRotateY,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
      gsap.to(clip, {
        rotateX: baseRotateX,
        rotateY: baseRotateY,
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
      className="w-screen h-[200vh] max-sm:h-screen bg-black relative"
    >
      <div className="fixed inset-0 bg-[#9C93E8] pointer-events-none h-full w-full ivention-overlay z-[99999]"></div>

      <div className="h-screen w-full max-sm:w-screen sticky top-0 max-sm:left-0 overflow-hidden flex justify-center items-center">
        <div
          ref={videoRef}
          className="h-[60vw] w-[102vw] max-sm:h-[55vw] max-sm:mx-auto max-sm:w-[90vw] opacity-0 hero-video relative z-40 rounded-[4.5vw] overflow-hidden shadow-2xl origin-center max-sm:rounded-[3.5vw]"
          style={isMobile ? {} : {
            transformStyle: "preserve-3d",
            transform: `perspective(800px) rotateX(${baseRotateX}deg) rotateY(${baseRotateY}deg) scale(${1 / 3})`,
            willChange: "transform",
          }}
          onClick={isMobile ? toggleMute : undefined}
        >
          <video
            ref={videoElRef}
            src="/assets/video/hero-vid.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Mobile mute indicator */}
          <div className="absolute inset-0 hidden max-sm:flex items-end justify-end p-3 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              {isMuted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </div>
          </div>
        </div>

        <ClipPath clipRef={clipRef} />

        {/* TEXT LAYER */}
        <div className="absolute inset-0 h-screen w-full flex items-center max-sm:flex-col max-sm:items-start max-sm:justify-between max-sm:pt-[22vw] max-sm:pb-[10vw] text-[#101417] justify-between z-20 px-[3vw] max-sm:px-[5vw]">
          <p className="text-[2.5vw] max-sm:text-[10vw] max-sm:text-white font-third leading-[1.1] hero-text max-sm:text-left">
            Trade the World's <br /> Attention
          </p>
          <p className="w-[23%] max-sm:w-full max-sm:text-[4vw] max-sm:leading-[1.5] max-sm:text-left max-sm:opacity-75 max-sm:mb-12 text-[1.3vw] leading-5.5 hero-text text-white">
            Markets open automatically when something trends. The more the conversation grows, the higher the floor locks in.
          </p>
        </div>

        {/* CUSTOM CURSOR PLAY/PAUSE — visible when video is fullscreen */}
        <div
          className="absolute inset-0 z-50 max-sm:hidden"
          style={{
            cursor: isFullyScaled ? "none" : "default",
            pointerEvents: isFullyScaled ? "auto" : "none",
          }}
          onClick={isFullyScaled ? togglePlayPause : undefined}
          onMouseMove={isFullyScaled ? handleCursorMove : undefined}
          onMouseEnter={() => isFullyScaled && setIsCursorVisible(true)}
          onMouseLeave={() => setIsCursorVisible(false)}
        />

        <div
          ref={cursorRef}
          className="fixed pointer-events-none z-[60] w-[4vw] h-[4vw] rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white text-[0.65vw] font-semibold font-display uppercase tracking-[0.2em] max-sm:hidden"
          style={{
            left: 0,
            top: 0,
            transform: "translate(-50%, -50%)",
            opacity: isCursorVisible && isFullyScaled ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        >
          {isPlaying ? (
            <svg width="1.5vw" height="1.5vw" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="1.5vw" height="1.5vw" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>

        {/* BOTTOM CONTROLS BAR — progress + mute side by side */}
        <div
          className="absolute bottom-0 left-0 right-0 z-50 px-8 pb-8 flex flex-row items-center gap-4 max-sm:hidden pointer-events-none"
          style={{ opacity: controlsOpacity }}
        >
          {/* Progress bar */}
          <div
            className="flex-1 h-[3px] bg-white/20 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
            style={{ pointerEvents: controlsOpacity > 0.1 ? "auto" : "none" }}
          >
            <div
              className="h-full bg-white rounded-full relative"
              style={{ width: `${videoProgress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className="w-10 h-10 shrink-0 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            style={{ pointerEvents: controlsOpacity > 0.1 ? "auto" : "none" }}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
        </div>

        {/* SVG DECORATION */}
        <div className="absolute bottom-5 max-sm:bottom-0 left-0 w-full h-[25%] max-sm:h-[15%] px-[2vw]">
          <Image
            width={1000}
            height={1000}
            src="/assets/svg/home-hero.svg"
            alt="text-svg"
            className="absolute bottom-5 max-sm:bottom-[-5vw] left-0 w-full h-full max-sm:px-4 object-contain mix-blend-color-burn opacity-90 z-10"
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
