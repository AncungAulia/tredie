"use client";
import React, { useRef } from "react";
import { gsap } from "gsap";

const Btn = ({ text = "Get to know us", bgColor = 'bg-white' }) => {
  const buttonRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // increase tilt strength
    const maxTilt = 20;
    const rotateX = ((y - centerY) / centerY) * maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    gsap.to(buttonRef.current, {
      duration: 0.5,
      rotationX: -rotateX,
      rotationY: rotateY,
      // scale: 1.08,
      transformPerspective: 600,
      ease: "power2.out",
      overwrite: "auto"
    });
  };

  const handleMouseLeave = () => {
    gsap.to(buttonRef.current, {
      duration: 0.6,
      rotationX: 0,
      rotationY: 0,
      // scale: 1,
      transformPerspective: 600,
      ease: "power2.out",
      overwrite: "auto"
    });
  };

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative px-[1vw] py-[0.5vw] cursor-pointer w-fit  font-body uppercase text-black text-[0.7vw] font-semibold rounded-sm ${bgColor}`}
    >
      {text}
    </button>
  );
};

export default Btn;