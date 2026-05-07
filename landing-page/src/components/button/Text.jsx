"use client";
import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";

export default function HoverTextReveal({ text = "Hover Me" }) {
  const wrapperRef = useRef(null);
  const [cycle, setCycle] = useState(0); // To track repeated hovers

  useEffect(() => {
    const el = wrapperRef.current;
    const lines = el.querySelectorAll(".text-line");

    // Reset positions
    gsap.set(lines[1], { y: "100%" });

    const handleHover = () => {
      const tl = gsap.timeline();

      tl.to(lines[0], {
        y: "-100%",
        duration: 0.6,
        ease: "power2.out",
      })
        .to(
          lines[1],
          {
            y: "0%",
            duration: 0.6,
            ease: "power2.out",
          },
          "<"
        )
        .add(() => {
          // After animation, swap text layers so it can repeat indefinitely
          gsap.set(lines[0], { y: "100%" });
          el.appendChild(lines[0]); // move first span to bottom
        });

      setCycle((prev) => prev + 1);
    };

    el.addEventListener("mouseenter", handleHover);
    return () => el.removeEventListener("mouseenter", handleHover);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative overflow-hidden text-black bg-red-500 inline-block h-[2.5vw] leading-[2.5vw] cursor-pointer select-none"
    >
      <span className="block text-line absolute top-0 left-0 w-full text-[2vw] font-medium">
        {text}
      </span>
      <span className="block text-line absolute top-0 left-0 w-full text-[2vw] font-medium">
        {text}
      </span>
    </div>
  );
}
