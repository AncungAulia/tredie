"use client";
import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Image from "next/image";
import IconButton from "../button/IconButton";

gsap.registerPlugin(ScrollTrigger);

/* ─── Data ─────────────────────────────────────────────────── */

const categoriesData = [
  {
    id: "01",
    category: "Trends",
    title: "If it's blowing up on social, it's already tradeable here.",
    backgroundColor: "bg-[#7B6ED8]",
    description:
      "Tredie watches X and Telegram in real time. The moment something starts trending, you can trade it. In seconds. No middlemen.",
    image:
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80",
    cta: "Start Trading",
  },
  {
    id: "02",
    category: "Attention",
    backgroundColor: "bg-[#4C4496]",
    title: "Popularity drives price. Get in before everyone else does.",
    description:
      "When something starts getting talked about, the price follows. Tredie tracks how fast buzz is growing so you can buy in before the crowd pushes the price up.",
    image:
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
    cta: "View Signals",
  },
  {
    id: "03",
    category: "Smart Tracking",
    backgroundColor: "bg-[#281F5E]",
    title: "We watch what people talk about. You just have to trade it.",
    description:
      "Tredie uses Elfa AI to spot what is starting to blow up online before it goes mainstream. Updated continuously, so you always see what is moving right now.",
    image: "/assets/img/elfa-ai-logo.png",
    cta: "See What's Trending",
  },
  {
    id: "04",
    category: "Trending Tokens",
    backgroundColor: "bg-[#110F28]",
    title: "When it blows up on X and Telegram, the market is already open.",
    description:
      "Tredie watches tokens going viral on X and Telegram. The moment one starts moving, we open a market automatically. No waiting.",
    image:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80",
    cta: "Find Markets",
  },
];

/* ─── Card ─────────────────────────────────────────────────── */

const SliderCard = ({
  id,
  category,
  title,
  description,
  backgroundColor,
  image,
  cta,
}) => {
  return (
    <div
      className={`flex-shrink-0 w-full origin-center h-full justify-between flex items-stretch overflow-hidden max-sm:flex-col max-sm:h-auto ${backgroundColor}`}
    >
      {/* LEFT — text */}
      <div className="w-[55%] h-[100%] flex flex-col justify-between py-[4vw] px-[2vw] max-sm:w-full max-sm:h-auto max-sm:py-[8vw] max-sm:px-[6vw]">
        <div>
          <h2 className="text-[7vw] font-third mb-[2vw] text-[#F3EFEB] max-sm:text-[14vw] max-sm:mb-[3vw]">
            {category}
          </h2>
        </div>

        <div className="flex justify-between gap-[12vw] max-sm:flex-col max-sm:gap-[4vw]">
          <div className="text-[8vw] w-fit font-third leading-none mb-[3vw] text-[#F3EFEB]/20 select-none max-sm:text-[20vw] max-sm:mb-[1vw]">
            {id}
          </div>

          <div className="flex-grow flex flex-col justify-center space-y-[2vw]">
            <h3 className="text-[2.5vw] font-display leading-[1.2] text-[#F3EFEB] max-sm:text-[5.5vw]">
              {title}
            </h3>
            <p className="text-[1.4vw] text-[#F3EFEB]/60 leading-[1.2] max-sm:text-[3.8vw] max-sm:leading-[1.4]">
              {description}
            </p>

          </div>
        </div>
      </div>

      {/* RIGHT — image */}
      <div className="w-[40%] h-[75%] my-auto p-[4vw] max-sm:w-full max-sm:h-auto max-sm:px-[6vw] max-sm:pt-0 max-sm:pb-[8vw] max-sm:my-0">
        <div className="h-full w-full overflow-hidden rounded-[2vw] max-sm:h-[55vw] max-sm:rounded-[4vw]">
          <Image
            width={800}
            height={800}
            src={image}
            alt={category}
            className="card-image w-full h-full rounded-[2vw] object-cover"
          />
        </div>
      </div>
    </div>
  );
};

/* ─── Section ──────────────────────────────────────────────── */

const Categories = () => {
  const containerRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(min-width: 640px)", () => {
      const ctx = gsap.context(() => {
        const cards = cardsRef.current;
        const numCards = cards.length;

        cards.forEach((card, i) => {
          gsap.set(card, {
            yPercent: i === 0 ? 0 : 100,
            zIndex: i + 1,
            scale: 1,
            rotation: 0,
            borderRadius: 0,
          });
        });

        const firstImage = cards[0].querySelector(".card-image");
        if (firstImage) {
          gsap.fromTo(
            firstImage,
            { scale: 1.5 },
            {
              scale: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: containerRef.current,
                start: "50% bottom",
                end: "bottom 60%",
                scrub: true,
              },
            },
            0,
          );
        }

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: `+=${(numCards - 1) * 100}%`,
            scrub: true,
          },
        });

        for (let i = 1; i < numCards; i++) {
          const rotateDir = (i - 1) % 2 === 0 ? -5 : 5;

          tl.to(cards[i], { yPercent: 0, ease: "none" }, i - 1);

          const currentCardImage = cards[i].querySelector(".card-image");
          if (currentCardImage) {
            tl.fromTo(
              currentCardImage,
              { scale: 1.2 },
              { scale: 1, ease: "none" },
              i - 0.5,
            );
          }

          tl.to(
            cards[i - 1],
            {
              scale: 0.8,
              rotation: rotateDir,
              rotateX: 20,
              borderRadius: "3vw",
              ease: "linear",
            },
            i - 1,
          ).to(cards[i - 1], { opacity: 0, ease: "none" }, i - 0.5);
        }
      }, containerRef);

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, []);

  return (
    <section id="markets" className="relative h-[380vh] max-sm:h-auto w-full z-0">
      <div
        ref={containerRef}
        className="sticky top-0 w-screen h-screen bg-black overflow-hidden max-sm:relative max-sm:h-auto"
        style={{ perspective: "1200px" }}
      >
        {categoriesData.map((category, i) => (
          <div
            key={category.id}
            ref={(el) => (cardsRef.current[i] = el)}
            className="absolute inset-0 overflow-hidden max-sm:static"
          >
            <SliderCard {...category} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default Categories;
