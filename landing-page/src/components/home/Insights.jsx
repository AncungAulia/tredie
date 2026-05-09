"use client";
import React, { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import ScrollTrigger from "gsap/dist/ScrollTrigger";
import Btn from "../button/Btn";

gsap.registerPlugin(ScrollTrigger);

const Insights = () => {
  const imageRefs = useRef([]);
  const imageWrapperRef = useRef(null);
  const containerRef = useRef(null);
  const headingRefs = useRef([]); //  separate refs
  const contentRefs = useRef([]); //  separate refs

  const baseRotateX = 5;
  const baseRotateY = -5;

  const mids = ["300+", "7", "<5s", "30", "1.2K"];

  const heading = [
    "Markets Live",
    "Asset Classes",
    "To First Trade",
    "SOL Starting Reserves",
    "Traders Daily",
  ];

  const content = [
    "Crypto, equities, commodities, FX, and contract addresses — all on-chain.",
    "Price follows attention. The louder the internet gets about something, the higher the floor — permanently.",
    "Email or wallet. Embedded or external. Trade in under 5 seconds.",
    "Live on Solana devnet. Early access. The mechanics are real.",
    "Mindshare data from Elfa AI powers every market discovery.",
  ];

  const imageSources = [
    "/assets/img/about-bg.jpeg",
    "/assets/img/about-bg-2.jpeg",
    "/assets/img/about-bg-3.jpeg",
    "/assets/img/about-bg-4.jpeg",
    "/assets/img/about-bg-5.jpeg",
  ];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const total = heading.length;

      heading.forEach((_, i) => {
        const startPos = (i / total) * 70;
        const endPos = ((i + 1) / total) * 80;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: "#insights",
            start: `${startPos}% top`,
            end: `${endPos}% top`,
            scrub: true,
            // markers: true,
          },
        });

        // === FIRST ===
        if (i === 0) {
          tl.fromTo(
            headingRefs.current[i],
            { y: 0, opacity: 1 },
            { y: 0, opacity: 1, duration: 1 }
          )
            .fromTo(
              contentRefs.current[i],
              { y: 0, opacity: 1 },
              { y: 0, opacity: 1, duration: 1 },
              "<"
            )
            .to(
              [headingRefs.current[i], contentRefs.current[i]],
              { y: -40, opacity: 0, ease: "power3.inOut", duration: 1 }
            );
        }

        // === LAST ===
        else if (i === total - 1) {
          tl.fromTo(
            headingRefs.current[i],
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, ease: "power3.out", duration: 1 }
          ).fromTo(
            contentRefs.current[i],
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, ease: "power3.out", duration: 1 },
            "<"
          );
        }

        // === MIDDLE ===
        else {
          tl.fromTo(
            headingRefs.current[i],
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, ease: "power3.out", duration: 1 }
          )
            .fromTo(
              contentRefs.current[i],
              { y: 60, opacity: 0 },
              { y: 0, opacity: 1, ease: "power3.out", duration: 1 },
              "<"
            )
            .to(
              [headingRefs.current[i], contentRefs.current[i]],
              { y: -60, opacity: 0, ease: "power3.inOut", duration: 1 }
            );
        }
      });

      gsap.to(".mid-nos", {
        yPercent: -62,
        ease: "linear",
        scrollTrigger: {
          trigger: "#insights",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          // markers: true,
          onUpdate: (self) => {
            const progress = self.progress;
            const total = imageSources.length;
            const activeIndex = Math.floor(progress * (total - 0.0001));

            imageRefs.current.forEach((img, i) => {
              if (!img) return;
              gsap.set(img, {
                opacity: i === activeIndex ? 1 : 0,
                duration: 0,
              });
            });
          },
        },
      });

      gsap.to(".mid-nos-top", {
        yPercent: -62,
        ease: "linear",
        scrollTrigger: {
          trigger: "#insights",
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          markers: false,
        },
      });
    });

    return () => ctx.revert();
  }, []);

  const handleMouseMove = (e) => {
    const container = containerRef.current;
    const image = imageWrapperRef.current;
    if (!container || !image) return;

    const { left, top, width, height } = container.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    const normX = (x - width / 2) / (width / 2);
    const normY = (y - height / 2) / (height / 2);

    const rotateY = baseRotateY + normX * 5;
    const rotateX = baseRotateX - normY * 5;

    gsap.to(image, {
      rotateX,
      rotateY,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeave = () => {
    const image = imageWrapperRef.current;
    if (!image) return;

    gsap.to(image, {
      rotateX: baseRotateX,
      rotateY: baseRotateY,
      duration: 0.6,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  return (
    <section
      id="insights"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-screen !h-[250vh] bg-[#F3EFEB] relative z-0  "
    >

      <div className="h-screen w-full overflow-hidden sticky top-0 flex items-center justify-between px-[5vw]">

     
      {/* === IMAGE STACK === */}
      <div
        ref={imageWrapperRef}
        className="w-[33vw] bg-black h-[22vw] absolute z-2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[1vw] overflow-hidden shadow-2xl"
        style={{
          transformStyle: "preserve-3d",
          transform: `perspective(800px) rotateX(${baseRotateX}deg) rotateY(${baseRotateY}deg)`,
        }}
      >
        {imageSources.map((src, i) => (
          <Image
            key={i}
            ref={(el) => (imageRefs.current[i] = el)}
            src={src}
            width={1000}
            height={1000}
            alt={`about-img-${i}`}
            className="w-full h-full object-cover absolute top-0 left-0 transition-opacity duration-500"
            style={{ opacity: i === 0 ? 1 : 0 }}
          />
        ))}
      </div>

      {/* LEFT: Heading */}
      <div className="w-[22%]">
        <div className="h-[8vw] relative  w-full">
          {heading.map((no, idx) => (
            <p
              key={idx}
              ref={(el) => (headingRefs.current[idx] = el)}
              className="text-black text-[3.4vw] opacity-0 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 leading-[1.2] font-bold text-center"
            >
              {no}
            </p>
          ))}
        </div>
      </div>

      {/* MID: Numbers */}
      <div className="w-[30%] h-full space-y-[15vw]">
        <div>
          <p className="text-[2vw] font-display">
            Where attention meets value
          </p>
        </div>

        <div className="h-[15vw]  w-full">
          <div className="h-[100vw] space-y-[1vw] mid-nos">
            {mids.map((no, idx) => (
              <p
                key={idx}
                className="text-white text-[10vw] font-bold text-center"
              >
                {no}
              </p>
            ))}
            <div className="w-full flex justify-center mt-[5vw]">
              <Btn text="Start Trading" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Content */}
      <div className="w-[22%]">
        <div className="h-[8vw] relative  w-full">
          {content.map((no, idx) => (
            <p
              key={idx}
              ref={(el) => (contentRefs.current[idx] = el)}
              className="text-black w-full text-[1.3vw] opacity-0 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 leading-[1.3] font-medium text-center"
            >
              {no}
            </p>
          ))}
        </div>
      </div>

      {/* Yellow overlay numbers */}
      <div className="h-[15vw] w-[30vw] overflow-hidden absolute z-4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[100vw] space-y-[1vw] mid-nos-top">
          {mids.map((no, idx) => (
            <p
              key={idx}
              className="text-white text-[10vw] font-bold text-center"
            >
              {no}
            </p>
          ))}
        </div>
      </div>
       </div>
    </section>
  );
};

export default Insights;
