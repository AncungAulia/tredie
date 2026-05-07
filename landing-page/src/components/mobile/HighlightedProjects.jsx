"use client";
import React, { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import MobileBtn from "../button/MobileBtn";
import MobileIconButton from "../button/MobileIconButton";
import Image from "next/image";

gsap.registerPlugin(SplitText);



const HighlightedProjects = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [nextSlide, setNextSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const slideRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayContentRef = useRef(null);
  const progressLineRef = useRef(null);
  const autoPlayRef = useRef(null);
  const currentTextRef = useRef(null);
  const nextTextRef = useRef(null);

  const slides = [
    {
      id: 1,
      title: "BONK:",
      subtitle: "Floor locked at 3.2x",
      category: "Meme Coin",
      location: "Solana",
      description:
        "BONK spiked on X. Elfa AI scored the mindshare in real time. Market spawned in 30 seconds. The floor never came back down.",
      bgImage: "https://images.unsplash.com/photo-1624996379697-f01d168b1a52?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 2,
      title: "WIF:",
      subtitle: "$200K in 30 minutes",
      category: "Meme Token",
      location: "Solana",
      description:
        "WIF went viral on Telegram. Tredie auto-spawned the market before any CEX listed it. Volume hit $200K in the first half hour.",
      bgImage: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 3,
      title: "AAPL:",
      subtitle: "Keynote priced in instantly",
      category: "Tokenized Equity",
      location: "Solana",
      description:
        "Apple keynote trended globally. Tredie's curve priced in the mindshare spike on-chain, 24/7. No waiting for a CEX to open.",
      bgImage: "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 4,
      title: "GOLD:",
      subtitle: "Commodity, on-chain",
      category: "Commodity",
      location: "Solana",
      description:
        "Gold surged on macro news. Tredie had a tradeable market live. No broker, no KYC, no weekend close.",
      bgImage: "https://images.unsplash.com/photo-1611162618758-2a29a995354b?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 5,
      title: "DOGE:",
      subtitle: "Floor tripled in 6 hours",
      category: "Meme Coin",
      location: "Solana",
      description:
        "Doge trended globally. Tredie spawned the market before any CEX caught up. The attention floor held.",
      bgImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const animateSlideChange = (direction) => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Calculate next slide index
    const nextIndex =
      direction === "next"
        ? currentSlide === slides.length - 1
          ? 0
          : currentSlide + 1
        : currentSlide === 0
        ? slides.length - 1
        : currentSlide - 1;

    setNextSlide(nextIndex);

    // Set initial state for next text to be invisible
    gsap.set(nextTextRef.current.querySelectorAll(".highlight-project-text"), {
      opacity: 0,
    });

    const tl = gsap.timeline({
      onComplete: () => {
        setIsAnimating(false);
        resetAutoPlay();
      },
    });

    // Animate out current text
    const currentSplitText = new SplitText(
      currentTextRef.current.querySelectorAll(".highlight-project-text"),
      {
        type: "chars,lines",
        linesClass: "lines",
        mask: "lines",
      }
    );

    tl.to(currentSplitText.lines, {
      yPercent: -100,
      opacity: 0,
      stagger: 0.02,
      duration: 0.3,
      ease: "power2.in",
    });

    // Animate clip-path opening from middle
    tl.to(
      overlayRef.current,
      {
        clipPath:
          "polygon(100% 50%, 100% 100%, 100% 100%, 0% 50%, 100% 0%, 100% 0%)",
        duration: 0.4,
        ease: "power2.in",
      },
      "-=0.1"
    ).to(overlayRef.current, {
      clipPath: "polygon(100% 50%, 100% 100%, 0% 100%, 0% 50%, 0% 0%, 100% 0%)",
      duration: 0.4,
      ease: "power2.out",
      onComplete: () => {
        setCurrentSlide(nextIndex);
      },
    });

    // Animate in next text
    tl.add(() => {
      gsap.set(nextTextRef.current.querySelectorAll(".highlight-project-text"), {
        opacity: 1,
      });

      const nextSplitText = new SplitText(
        nextTextRef.current.querySelectorAll(".highlight-project-text"),
        {
          type: "chars,lines",
          linesClass: "lines",
          mask: "lines",
        }
      );

      gsap.from(nextSplitText.lines, {
        yPercent: 100,
        opacity: 0,
        stagger: 0.02,
        duration: 0.3,
        ease: "power2.out",
      });
    }, "-=0.2");

    tl.to(overlayRef.current, {
      clipPath:
        "polygon(100% 50%, 100% 50%, 100% 50%, 0% 50%, 100% 50%, 100% 50%)",
      duration: 0,
      delay: 0.1,
    });
  };

  const handleNext = () => {
    animateSlideChange("next");
  };

  const handlePrev = () => {
    animateSlideChange("prev");
  };

  // const resetAutoPlay = () => {
  //   if (autoPlayRef.current) {
  //     clearInterval(autoPlayRef.current);
  //   }
  //   autoPlayRef.current = setInterval(() => {
  //     animateSlideChange("next");
  //   }, 5000);
  // };

  useEffect(() => {
    // Animate progress line
    const progress = ((currentSlide + 1) / slides.length) * 100;
    gsap.to(progressLineRef.current, {
      width: `${progress}%`,
      duration: 0.5,
      ease: "power2.out",
    });
  }, [currentSlide, slides.length]);

  // useEffect(() => {
  //   resetAutoPlay();
  //   return () => {
  //     if (autoPlayRef.current) {
  //       clearInterval(autoPlayRef.current);
  //     }
  //   };
  // }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">

      <div className="absolute z-10 top-1/2 -translate-y-1/2 w-screen h-0.5 bg-white/20 mb-6">
              <div
                ref={progressLineRef}
                className=" h-full bg-white transition-all"
                style={{ width: "0%" }}
              ></div>
            </div>
      {/* Current Slide */}
      <div
        ref={slideRef}
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: `url(${slides[currentSlide].bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/10"></div>

        {/* Content */}
        <div
          ref={currentTextRef}
          className="relative z-10 flex flex-col justify-center h-full gap-32 px-4 pt-12"
        >
          {/* Top Content */}
          <div className="pt-36">
            <div className=" min-h-30">

            <h2 className="highlight-project-text text-white text-3xl font-bold leading-none ">
              {slides[currentSlide].title}
            </h2>
            <h2 className="highlight-project-text text-white text-3xl font-bold leading-none mb-8">
              {slides[currentSlide].subtitle}
            </h2>
            </div>
            <div className="flex gap-8 mb-8">
              <span className="highlight-project-text text-white text-base">
                {slides[currentSlide].category}
              </span>
              <span className="highlight-project-text text-white text-base">
                {slides[currentSlide].location}
              </span>
            </div>
          </div>

          {/* Bottom Content */}
          <div>
            <p className="highlight-project-text text-white text-[5vw] leading-none mb-8 ">
              {slides[currentSlide].description}
            </p>
          </div>
        </div>
      </div>

      {/* Clip-path Overlay - Next Slide */}
      <div
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        style={{
          clipPath:
            "polygon(100% 50%, 100% 50%, 100% 50%, 0% 50%, 100% 50%, 100% 50%)",
          backgroundImage: `url(${slides[nextSlide].bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/10"></div>

        {/* Next Slide Content */}
        <div
          ref={nextTextRef}
          className="relative z-10 flex flex-col justify-center gap-32 h-full px-4 pt-12"
        >
          {/* Top Content */}
          <div className="pt-36">
            <div className=" min-h-30">

            <h2 className="highlight-project-text text-white text-3xl font-bold leading-none ">
              {slides[nextSlide].title}
            </h2>
            <h2 className="highlight-project-text text-white text-3xl font-bold leading-none mb-8">
              {slides[nextSlide].subtitle}
            </h2>
            </div>
            <div className="flex gap-8 mb-8">
              <span className="highlight-project-text text-white text-base">
                {slides[nextSlide].category}
              </span>
              <span className="highlight-project-text text-white text-base">
                {slides[nextSlide].location}
              </span>
            </div>
          </div>

          {/* Bottom Content */}
          <div>
            <p className="highlight-project-text text-white text-[5vw] leading-none mb-8">
              {slides[nextSlide].description}
            </p>
          </div>
        </div>
      </div>

      {/* Fixed Elements - Always visible, never animated */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-30">
        <div className="relative flex flex-col justify-between h-full px-4 pt-12">
          {/* Top Fixed Content */}
          <div className="pt-40">
            <p className="text-white font-display text-xl mb-8">
              Live market stories
            </p>
          </div>

          {/* Bottom Fixed Content */}
          <div>

          <div className="pointer-events-auto flex justify-between pb-5">
            {/* View Our Work Button */}
            <MobileBtn text="OPEN APP" />

            {/* Progress Line */}
            {/* <div className="relative w-full h-0.5 bg-white/30 mb-6">
              <div
              ref={progressLineRef}
                className="absolute left-0 top-0 h-full bg-white transition-all"
                style={{ width: "0%" }}
                ></div>
            </div> */}

            {/* Navigation Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handlePrev}
                disabled={isAnimating}
                className="w-12 h-10 rounded-md bg-white backdrop-blur-sm flex items-center justify-center disabled:opacity-80 transition-opacity "
              >
                
        <Image src='/assets/icons/prev-icon.svg' width={200} height={200} alt='icon' className='w-7 h-7 ' />
              </button>
              <button
                onClick={handleNext}
                disabled={isAnimating}
                className="w-12 h-10 rounded-md bg-white backdrop-blur-sm flex items-center justify-center disabled:opacity-80 transition-opacity "
                >
        <Image src='/assets/icons/next-icon.svg' width={200} height={200} alt='icon' className='w-7 h-7 ' />
              </button>
            </div>
                </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighlightedProjects;