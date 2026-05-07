"use client";
import React, { useRef } from "react";
import gsap from "gsap";

const TextAnim = ({ text, textSize }) => {
  const topTextRef = useRef(null);
  const bottomTextRef = useRef(null);


  const enter = () => {
    gsap.to(topTextRef.current, { y: '-4.5vw', duration: 0.5, ease: "power2.out" });
    gsap.to(bottomTextRef.current, { y: '0vw', duration: 0.5, ease: "power2.out" });
  };

  const leave = () => {
    gsap.to(topTextRef.current, { y: '0vw', duration: 0, ease: "linear" });
    gsap.to(bottomTextRef.current, { y: '4.5vw', duration: 0, ease: "linear" });
  };

  return (
    <div
      onMouseEnter={enter}
      onMouseLeave={leave}
      className="cursor-pointer  relative  w-[23vw] h-[3.5vw] bg- overflow-hidden"
    >
      <div className="w-full h-full flex items-center justify-center">
        <p ref={topTextRef} className={`${textSize} leading-[1]`}>{text}</p>
      </div>

      <div className="absolute w-[23vw] flex items-center justify-center b h-[3.5vw] top-0 left-0">

      <p
        ref={bottomTextRef}
        className={` translate-y-full h-full w-full flex items-center justify-center ${textSize} leading-[1]`}
        // style={{ transform: 'translateY(60%)' }}
        >
        {text}
      </p>
        </div>
    </div>
  );
};

export default TextAnim;