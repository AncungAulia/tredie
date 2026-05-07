"use client";
import React, { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import Image from "next/image";
import IconButton from "../button/IconButton";
import MobileBtn from "../button/MobileBtn";

gsap.registerPlugin(SplitText);

const CaseStudy = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const currentTextRef = useRef(null);

  const slides = [
    {
      id: 1,
      ticker: "BONK",
      assetClass: "Meme Coin",
      marketType: "Trend Auto-Spawn",
      network: "Solana",
      testimonial:
        '"BONK was spiking on every X feed. Tredie had the market live before any CEX touched it. Bought at 1.0x floor. Locked in at 3.2x after the second wave."',
      role: "Crypto Trader",
      company: "Tredie Community",
      logo: "/assets/img/party-1.jpeg",
    },
    {
      id: 2,
      ticker: "WIF",
      assetClass: "Meme Token",
      marketType: "Mindshare Spike",
      network: "Solana",
      testimonial:
        '"WIF was all over Telegram. Elfa AI scored the spike and spawned the market in under 30 seconds. Floor tripled before most traders heard about it."',
      role: "DeFi Trader",
      company: "Early Adopter",
      logo: "/assets/img/party-2.jpeg",
    },
    {
      id: 3,
      ticker: "AAPL",
      assetClass: "Tokenized Equity",
      marketType: "Mindshare Event",
      network: "Solana",
      testimonial:
        '"Apple keynote trended globally. Tredie\'s curve priced in the mindshare instantly. On-chain, 24/7, no waiting for a CEX to open."',
      role: "Equity Trader",
      company: "Tredie Community",
      logo: "/assets/img/party-1.jpeg",
    },
  ];

  const animateTextIn = () => {
    const split = new SplitText(
      currentTextRef.current.querySelectorAll(".case-study-text"),
      {
        type: "lines",
        linesClass: "line",
      }
    );

    gsap.set(split.lines, { yPercent: 100, opacity: 0 });

    gsap.to(split.lines, {
      yPercent: 0,
      opacity: 1,
      stagger: 0.04,
      duration: 0.4,
      ease: "power2.out",
    });
  };

  const animateSlideChange = (direction) => {
    if (isAnimating) return;
    setIsAnimating(true);

    const nextIndex =
      direction === "next"
        ? (currentSlide + 1) % slides.length
        : (currentSlide - 1 + slides.length) % slides.length;

    const oldSplit = new SplitText(
      currentTextRef.current.querySelectorAll(".case-study-text"),
      {
        type: "lines",
        linesClass: "line",
      }
    );

    const tl = gsap.timeline({
      onComplete: () => {
        setCurrentSlide(nextIndex);
      },
    });

    tl.to(oldSplit.lines, {
      yPercent: -100,
      opacity: 0,
      stagger: 0.04,
      duration: 0.4,
      ease: "power2.inOut",
    });
  };

  const handleNext = () => {
    animateSlideChange("next");
  };

  const handlePrev = () => {
    animateSlideChange("prev");
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      animateTextIn();
    });

    const timeout = setTimeout(() => setIsAnimating(false), 800);
    
    return () => {
      ctx.revert();
      clearTimeout(timeout);
    };
  }, [currentSlide]);

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-12">
      <style jsx>{`
        .line {
          overflow: hidden;
          display: block;
        }
      `}</style>

      <div className="max-w-md mx-auto">
        {/* Current Slide Content */}
        <div ref={currentTextRef} className="relative">
          {/* Header Info Grid */}
          <div className="grid grid-cols-2 gap-y-6 mb-24">
            <div>
              <p className="text-[3.5vw] text-gray-700 uppercase tracking-wider mb-1">
                Ticker
              </p>
              <p className="case-study-text text-[5vw]  font-medium text-gray-900">
                {slides[currentSlide].ticker}
              </p>
            </div>
            <div>
              <p className="text-[3.5vw] text-gray-500 uppercase tracking-wider mb-1">
                Asset Class
              </p>
              <p className="case-study-text text-[5vw] font-medium text-gray-900">
                {slides[currentSlide].assetClass}
              </p>
            </div>
            <div>
              <p className="text-[3.5vw] text-gray-500 uppercase tracking-wider mb-1">
                Market Type
              </p>
              <p className="case-study-text text-[5vw] font-medium text-gray-900">
                {slides[currentSlide].marketType}
              </p>
            </div>
            <div>
              <p className="text-[3.5vw] text-gray-500 uppercase tracking-wider mb-1">
                Network
              </p>
              <p className="case-study-text text-[5vw] font-medium text-gray-900">
                {slides[currentSlide].network}
              </p>
            </div>
          </div>

          {/* Testimonial */}
          <div className="mb-8">
            <p className="case-study-text text-[7.5vw] leading-[1.2] text-left text-neutral-800 font-display mb-28">
              {slides[currentSlide].testimonial}
            </p>
          </div>

          {/* Company Logo */}
          

          {/* Role and Company */}
          <div className="text-center mb-6">
            <p className="case-study-text text-[5vw] font-semibold text-nowrap  text-neutral-900">
              {slides[currentSlide].role}
            </p>
            <p className="case-study-text text-[4vw] text-gray-600 my-4">
              {slides[currentSlide].company}
            </p>
          </div>

          <div className="flex justify-center mb-15">
            <div className="w-28 h-20 relative">
              <Image
                src={slides[currentSlide].logo}
                width={64}
                height={64}
                alt={slides[currentSlide].company}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>  

          <div className="flex justify-between">
           

          {/* See Full Case Study Button */}
          <div className="w-[60%]">
            
            <MobileBtn text='OPEN MARKET' />
          </div>
       

        {/* Navigation */}
        <div className="flex items-center justify-between w-[40%]">
          <div className="text-sm font-medium text-neutral-900">
            {String(currentSlide + 1).padStart(2, "0")} /{" "}
            {String(slides.length).padStart(2, "0")}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrev}
              disabled={isAnimating}
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-900 hover:border-gray-900 hover:text-white transition-colors duration-300 disabled:opacity-50"
            >
              <Image
                src="/assets/icons/prev-icon.svg"
                width={20}
                height={20}
                alt="Previous"
                className="w-7 h-7"
              />
            </button>
            <button
              onClick={handleNext}
              disabled={isAnimating}
              className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-900 hover:border-gray-900 hover:text-white transition-colors duration-300 disabled:opacity-50"
            >
              <Image
                src="/assets/icons/next-icon.svg"
                width={20}
                height={20}
                alt="Next"
                className="w-7 h-7"
              />
            </button>
          </div>
        </div>
         </div>
         </div>  
      </div>
    </div>
  );
};

export default CaseStudy;