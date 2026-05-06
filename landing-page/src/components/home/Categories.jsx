"use client";
import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";
import Btn from "../button/Btn";
import IconButton from "../button/IconButton";
import TextAnim from "../text-animation/TextAnim";

gsap.registerPlugin(ScrollTrigger);

const categoriesData = [
  {
    id: "01",
    category: "Crypto",
    title: "SOL, BONK, WIF, JTO and all trending tokens",
    backgroundColor: "bg-[#F7FFDC]",
    description:
      "Trade the tokens everyone's talking about. Price moves purely on supply and demand — mindshare data from Elfa AI powers every market discovery.",
    image: "/assets/img/about-bg-2.jpeg",
    cta: "Trade now",
  },
  {
    id: "02",
    category: "Equities",
    backgroundColor: "bg-[#D1F3F5]",
    title: "xyz:NVDA, xyz:TSLA, xyz:AMZN — tokenized equities",
    description:
      "Trade Nvidia earnings hype before Wall Street opens. Tokenized equities via the HIP-3 standard, fully on-chain on Solana devnet.",
    image: "/assets/img/about-bg.jpeg",
    cta: "Explore markets",
  },
  {
    id: "03",
    category: "Commodities",
    backgroundColor: "bg-[#DDD9FF]",
    title: "xyz:XAU, xyz:CL, xyz:DXY — gold, oil & FX",
    description:
      "Gold. Oil. FX. Real-world assets with on-chain social momentum. Trade the narrative before the price moves.",
    image: "/assets/img/about-bg-3.jpeg",
    cta: "View markets",
  },
  {
    id: "04",
    category: "Trending CAs",
    backgroundColor: "bg-[#FFDDCA]",
    title: "X-trending & TG-trending contract addresses",
    description:
      "Contract addresses blowing up on X and Telegram. Tredie finds them first via Elfa AI and spawns a tradeable market automatically.",
    image: "/assets/img/about-bg-4.jpeg",
    cta: "Discover more",
  },
];

const SliderCard = ({
  id,
  category,
  title,
  description,
  image,
  cta,
  backgroundColor,
}) => {
  return (
    <div
      className={`flex-shrink-0 w-full origin-center h-full justify-between flex items-stretch overflow-hidden ${backgroundColor}`}
    >
      <div className="w-[55%] h-[100%] flex flex-col justify-between py-[4vw] px-[2vw]">
        <div>
          <h2 className="text-[7vw] font-third f mb-[2vw]">{category}</h2>
        </div>

        <div className="flex justify-between gap-[12vw]">
          <div className="text-[8vw] w-fit font-third leading-none mb-[3vw]">
            {id}
          </div>

          <div className="flex-grow  flex flex-col justify-center space-y-[2vw]">
            <h3 className="text-[2.5vw] font-display leading-[1.2] ">
              {title}
            </h3>
            <p className="text-[1.4vw] text-gray-700 leading-[1.2]">
              {description}
            </p>

            <div className="flex gap-[1vw] items-center">

            {/* <TextAnim text={cta} textSize='text-[2.5vw] font-third text-neutral-800' /> */}

            <button
      className={`relative px-[1vw] group flex items-start justify-center overflow-hidden  cursor-pointer h-[3.5vw]  w-fit  font-body  text-black text-[0.7vw] font-semibold rounded-[2vw] ${backgroundColor}`}
    >

      <div className={` w-fit transition-none group-hover:transition-all group-hover:duration-300 group-hover:translate-y-[-3vw] flex flex-col items-start justify-end`}>
        <p className={`text-[2vw] `}>

          {cta}
        </p>
         <p className={`text-[2vw] `}>

          {cta}
        </p>
      </div>
    </button>
              

              <IconButton
                icon="/assets/icons/icon-arrow.svg"
                // height="5vw"
                pad="w-[4.2vw] h-[4.2vw]"
                />
           
                </div>

            {/* <Btn /> */}
          </div>
        </div>
      </div>

      <div className="w-[40%] h-[75%] my-auto p-[4vw]">
        <div className="h-full w-full overflow-hidden rounded-[2vw]">
          <Image
            width={1000}
            height={1000}
            src={image}
            alt={title}
            className="card-image w-full h-full rounded-[2vw] object-cover"
          />
        </div>
      </div>
    </div>
  );
};

const Categories = () => {
  const containerRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current;
      const numCards = cards.length;

      // Initial setup
      cards.forEach((card, i) => {
        gsap.set(card, {
          yPercent: i === 0 ? 0 : 100,
          zIndex: i + 1,
          // transformOrigin: i % 2 === 0 ? "left center" : "right center",
          scale: 1,
          rotation: 0,
          borderRadius: 0,
        });
      });

      const firstImage = cards[0].querySelector(".card-image");
      if (firstImage) {
        gsap.fromTo(
          firstImage,
          {
            scale: 1.5,
          }, {
            scale:1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: containerRef.current,
              start: "50% bottom",
              end: "bottom 60%",
              scrub: true,
              // markers:true,
            },
          },
          0
        );
      }

      // Scroll-triggered timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: `+=${(numCards - 1) * 100}%`,
          scrub: true,
          // pin: true,
          // markers: true,
        },
      });

      // Animate the sliding + rotation combo
      for (let i = 1; i < numCards; i++) {
        const rotateDir = (i - 1) % 2 === 0 ? -5 : 5; // previous card direction

        // Move next card upward
        tl.to(
          cards[i],
          {
            yPercent: 0,
            ease: "none",
          },
          i - 1
        );

        // Image scale animation - starts at middle of the slide
        const currentCardImage = cards[i].querySelector(".card-image");
        if (currentCardImage) {
          tl.fromTo(
            currentCardImage,
            {
              scale: 1.2,
            }, 
            {
              scale: 1,
              ease: "none",
            },
            i - 0.5  // Starts halfway through the slide animation
          );
        }

        // Simultaneously rotate & scale down previous card
        tl.to(
          cards[i - 1],
          {
            // y: `4vw`,
            scale: 0.8,
            rotation: rotateDir,
            // z: -400, // moves card backward along Z-axis
            rotateX: 20,
            borderRadius: "3vw",
            // transformOrigin: "center center",
            ease: "linear",
          },
          i - 1
        ).to(
          cards[i - 1],
          {
            opacity: 0,
            ease: "none",
          },
          i - 0.5
        );
      }
    }, containerRef);

    

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative h-[380vh] w-full z-0">
      <div
        ref={containerRef}
        className="sticky top-0 w-screen h-screen bg-black overflow-hidden"
        style={{ perspective: "1200px" }}
      >
        {categoriesData.map((category, i) => (
          <div
            key={category.id}
            ref={(el) => (cardsRef.current[i] = el)}
            className="absolute inset-0 overflow-hidden"
          >
            <SliderCard {...category} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default Categories;