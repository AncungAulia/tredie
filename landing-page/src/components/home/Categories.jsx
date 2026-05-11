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
    category: "Topics",
    title: "Topics trend every day. Most of that attention had nowhere to go.",
    backgroundColor: "bg-[#7B6ED8]",
    description:
      "When a topic starts gaining traction on X or Telegram, a market opens for it on Tredie. You trade the conversation, not a derivative of it.",
    image:
      "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778527448/Topics_trend_every_day_o8mytv.png",
    cta: "Start Trading",
  },
  {
    id: "02",
    category: "Attention",
    backgroundColor: "bg-[#4C4496]",
    title: "Attention has always moved prices. It never had a price of its own.",
    description:
      "On Tredie, each market's price reflects the attention a topic is getting. When social interest grows, the price floor moves with it. You can see where the conversation is going before the price gets there.",
    image:
      "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778528025/WhatsApp_Image_2026-05-12_at_02.33.33_shenyh.jpg",
    cta: "View Signals",
  },
  {
    id: "03",
    category: "Signal",
    backgroundColor: "bg-[#281F5E]",
    title: "By the time it's in the news, the interesting trade already happened.",
    description:
      "Tredie surfaces what's gaining traction on X and Telegram before it becomes mainstream. The feed shows what the internet is watching right now, not yesterday.",
    image: "/assets/img/elfa-ai-logo.png",
    cta: "See What's Trending",
  },
  {
    id: "04",
    category: "Tokens",
    backgroundColor: "bg-[#110F28]",
    title: "A token went viral on X this week. Its market was already live.",
    description:
      "Tokens gaining traction on X and Telegram get markets automatically on Tredie. Not after someone notices. The moment attention builds.",
    image:
      "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778529329/tokenstredie_y24ocf.jpg",
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
