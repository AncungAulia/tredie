"use client";
import Image from "next/image";
import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import IconButton from "../button/IconButton";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger)

const QuoteContact = () => {
  const leftClipRef = useRef(null);
  const rightClipRef = useRef(null);
  const containerRef = useRef(null);
  const leftTriggerRef = useRef(null);
  const rightTriggerRef = useRef(null);
  const imageRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const images = [
    "/assets/img/party-1.jpeg", // default
    "/assets/img/arena.jpeg",   // left hover
    "/assets/img/party-2.jpeg", // right hover
  ];

  useEffect(() => {
    const leftClip = leftClipRef.current;
    const rightClip = rightClipRef.current;
    const leftTrigger = leftTriggerRef.current;
    const rightTrigger = rightTriggerRef.current;

    
    const tlLeftEnter = gsap.timeline({ paused: true }).to(leftClip, {
      clipPath: "polygon(41% 0%, 61.5% 0%, 95.75% 100%, 3.75% 100%)",
      duration: 0.4,
      ease: "power2.out",
    });

    const tlLeftLeave = gsap.timeline({ paused: true }).to(leftClip, {
      clipPath: "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)",
      duration: 0.4,
      ease: "power2.inOut",
    });

    const tlRightEnter = gsap.timeline({ paused: true }).to(rightClip, {
      clipPath: "polygon(41% 0%, 61.5% 0%, 95.75% 100%, 3.25% 100%)",
      duration: 0.4,
      ease: "power2.out",
    });

    const tlRightLeave = gsap.timeline({ paused: true }).to(rightClip, {
      clipPath: "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)",
      duration: 0.4,
      ease: "power2.inOut",
    });

  
    const crossfadeTo = (index) => {
      const current = imageRefs.current[activeIndex];
      const next = imageRefs.current[index];

      if (index === activeIndex) return;

      gsap.set(next, { opacity: 0, zIndex: 2 });
      gsap.to(current, { opacity: 0, duration: 0.2, ease: "power2.inOut" });
      gsap.to(next, {
        opacity: 1,
        duration: 0.2,
        ease: "power2.inOut",
        onComplete: () => {
          setActiveIndex(index);
        },
      });
    };

    const onLeftEnter = () => {
      tlLeftEnter.play(0);
      crossfadeTo(1);
    };
    const onLeftLeave = () => {
      tlLeftLeave.play(0);
      crossfadeTo(0);
    };
    const onRightEnter = () => {
      tlRightEnter.play(0);
      crossfadeTo(2);
    };
    const onRightLeave = () => {
      tlRightLeave.play(0);
      crossfadeTo(0);
    };

    leftTrigger.addEventListener("mouseenter", onLeftEnter);
    leftTrigger.addEventListener("mouseleave", onLeftLeave);
    rightTrigger.addEventListener("mouseenter", onRightEnter);
    rightTrigger.addEventListener("mouseleave", onRightLeave);

    return () => {
      leftTrigger.removeEventListener("mouseenter", onLeftEnter);
      leftTrigger.removeEventListener("mouseleave", onLeftLeave);
      rightTrigger.removeEventListener("mouseenter", onRightEnter);
      rightTrigger.removeEventListener("mouseleave", onRightLeave);
    };
  }, [activeIndex]);

  useEffect(() => {
    const ctx = gsap.context(() => {
        gsap.fromTo('#quote-wrap', {
          yPercent:-50,
        }, {
          yPercent:0,
          ease:'none',
          scrollTrigger: {
            trigger:'#quote-wrap',
             start: 'top bottom',
          end:'bottom 50%',
          scrub: true,
          // markers:true
          }

        })
    })
    ScrollTrigger.refresh();
    return () => ctx.revert();
  })

  return (

    <div className="h-fit translate-y-[-50%] w-full relative z-50" id="quote-wrap">

    
    <section
      ref={containerRef}
      className="w-full h-screen sticky top-0  overflow-hidden bg-black"
    >
      {/* Image Layer Stack */}
      <div className="absolute inset-0">
        {images.map((src, i) => (
          <Image
            key={src}
            ref={(el) => (imageRefs.current[i] = el)}
            src={src}
            fill
            alt="contact-img"
            className={`object-cover absolute top-0 left-0 transition-opacity duration-500 ${
              i === activeIndex ? "opacity-100 z-[1]" : "opacity-0 z-0"
            }`}
            priority
          />
        ))}
      </div>

      {/* Headings */}
      <div className="absolute font-third z-5 top-[35%] left-[15%]  text-[6.5vw] text-white">
        LAUNCH
      </div>
      <div className="w-[20vw] bg-[#9C93E8] h-[0.2px] absolute top-[51%] left-[15%] z-5" />
      <div className=" absolute font-third z-5 top-[35%] right-[13%] text-[6.5vw] text-white">
        DOCS
      </div>
      <div className="w-[22vw] bg-[#9C93E8] h-[0.2px] absolute top-[51%] right-[13%] z-5" />

      {/* Left Clip Path */}
      <div
        ref={leftClipRef}
        className="absolute flex z-10  flex-col cursor-pointer items-center py-[2vw] gap-[15vw] top-0 left-0 w-1/2 h-full bg-[#9C93E8]"
        style={{
          clipPath: "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)",
        }}
      >
        <p className="text-[1.8vw] leading-none text-center font-third w-[8vw]">
          Your trade is waiting
        </p>

        <div className="w-[22vw] space-y-[2vw]">
          <p className="text-[3.5vw] text-center leading-[1.2]  font-third">
            Got a ticker in mind?
          </p>
          <p className="text-[1.3vw] font-medium text-center leading-[1.3]">
            Search any token, equity, or paste a social link. We'll find or create the market instantly.
          </p>

          <div className="w-fit mx-auto flex items-center gap-[1vw]">
            <p className="text-[0.8vw] font-semibold font-display uppercase">
              Start Trading
            </p>
            <IconButton icon="/assets/icons/icon-arrow.svg" pad="h-[3vw] w-[3vw]" />
          </div>
        </div>
      </div>

      {/* Right Clip Path */}
      <div
        ref={rightClipRef}
        className="absolute flex z-10 flex-col !cursor-pointer !pointer-events-auto items-center gap-[15vw] py-[2vw] pl-[1.2vw] top-0 right-0 w-1/2 h-full bg-[#9C93E8] "
        style={{
          clipPath: "polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)",
        }}
      >
        <p className="text-[1.8vw] leading-none text-center font-third w-[8vw]">
          Your trade is waiting
        </p>

        <div className="w-[25vw] space-y-[2vw]">
          <p className="text-[3.5vw] text-center leading-[1.2] font-third ">
            Want to create a market?
          </p>
          <p className="text-[1.3vw] font-medium text-center leading-[1.3]">
            Paste a TikTok or tweet. We extract the asset and spawn a market in seconds.
          </p>

          <div className="w-fit mx-auto flex items-center gap-[1vw]">
            <p className="text-[0.8vw] font-semibold font-display uppercase">
              Learn More
            </p>
            <IconButton icon="/assets/icons/icon-arrow.svg" pad="h-[3vw] w-[3vw]" />
          </div>
        </div>
      </div>

      {/* Trigger Areas */}
      <div
        ref={leftTriggerRef}
        className="absolute top-0 left-[10%] w-[28%] h-full z-10 !pointer-events-auto cursor-pointer"
      ></div>
      <div
        ref={rightTriggerRef}
        className="absolute top-0 right-[10%] w-[28%] h-full z-10 cursor-pointer"
      ></div>
    </section>
    </div>
  );
};

export default QuoteContact;
