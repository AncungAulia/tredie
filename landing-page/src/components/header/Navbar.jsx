"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { useLenis } from "lenis/react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hasAnimated, setHasAnimated] = useState(false);
    const [hasAnimated2, setHasAnimated2] = useState(false);

  const lenis = useLenis();

  useEffect(() => {
    gsap.set(".nav-menu-item", {
      yPercent: -100,
      // opacity:1,
    });
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".nav-menu-item-first",
        {
          yPercent: -100,
        },
        {
          yPercent: 0,
          delay: 0.5,
          ease: "power2.out",
          duration: 0.4,
        }
      );
      gsap.fromTo(
        ".nav-menu-item",
        {
          yPercent: -100,
        },
        {
          yPercent: 0,
          stagger: 0.2,
          duration: 0.7,
          ease: "power2.out",
          delay: 1,
        }
      );
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!lenis) return;

    if (menuOpen || projectOpen) {
      lenis.stop();
    } else {
      lenis.start();
    }
  }, [menuOpen, projectOpen]);

  const projectOverlayRef = useRef(null);
  const projectWrapperRef = useRef(null);
  const animationRef = useRef(null);
  const menuOverlayRef = useRef(null);

  const navItems = [
    { title: "About", href: "/about" },
    { title: "Markets", href: "/markets" },
    { title: "How It Works", href: "/how-it-works" },
    { title: "Trending", href: "/trending" },
    { title: "Portfolio", href: "/portfolio" },
    { title: "Leaderboard", href: "/leaderboard" },
    { title: "Docs", href: "/docs" },
    { title: "Contact", href: "/contact" },
  ];

  const getClipPathFromPosition = (x, width) => {
    const normalizedX = x / width;
    // Clamp normalizedX between 0.2 and 1 to allow more movement on both sides
    const clampedX = Math.max(0.2, normalizedX);
    const easedX = 1 - Math.pow(1 - clampedX, 2.2);

    const bottomLeftX = 5 + easedX * 75; // Increased from 65 to 70
    const leftY = 5 + easedX * 75; // Increased from 75 to 82
    const leftX = easedX * 7.5; // Increased from 6.5 to 7

    return `polygon(100% 0%, 100% 4.75%, ${bottomLeftX}% 100%, ${leftX}% 100%, ${leftX}% ${leftY}%, 92.5% 0%)`;
  };

  const handleProjectHover = (e) => {
    if (!projectOpen || !projectOverlayRef.current) return;

    const x = e.clientX;
    const width = window.innerWidth;

    const newClipPath = getClipPathFromPosition(x, width);

    if (animationRef.current) {
      animationRef.current.kill();
    }

    animationRef.current = gsap.to(projectOverlayRef.current, {
      clipPath: newClipPath,
      duration: 0.6,
      ease: "power2.out",
    });
  };

  useEffect(() => {
    const wrapper = projectWrapperRef.current;

    if (!wrapper) return;

    const closedClip = "circle(0% at 100% 0%)";
    const openClip = "circle(160% at 100% 0%)";

    if (projectOpen) {
      gsap.set(projectOverlayRef.current, {
        clipPath:
          "polygon(100% 0%, 100% 4.75%, 66.25% 100%, 0% 100%, 0% 75.25%, 92.5% 0%)",
        borderBottomLeftRadius: "5vw",
      });

      gsap.fromTo(
        wrapper,
        { clipPath: closedClip },
        {
          clipPath: openClip,
          duration: 0.8,
          ease: "power1.inOut",
        }
      );
    } else {
      gsap.to(wrapper, {
        clipPath: closedClip,
        duration: 0.8,
        ease: "power1.inOut",
      });
    }
  }, [projectOpen]);

  useEffect(() => {
    const overlay = menuOverlayRef.current;
    if (!overlay) return;

    const closedClip = "circle(0% at 0% 0%)";
    const openClip = "circle(160% at 0% 0%)";

    if (menuOpen) {
      gsap.fromTo(
        overlay,
        { clipPath: closedClip },
        {
          clipPath: openClip,
          duration: 0.8,
          ease: "power1.inOut",
        }
      );
    } else {
      gsap.to(overlay, {
        clipPath: closedClip,
        duration: 0.8,
        ease: "power1.inOut",
      });
    }
  }, [menuOpen]);

  const handleMenuHover = () => {
    if (!hasAnimated) {
      setHasAnimated(true);
      setTimeout(() => setHasAnimated(false), 500);
    }
    gsap.fromTo(
      ".menu-below-text",
      {
        y: "1vw",
        opacity: 0,
      },
      {
        y: "0vw",
        opacity: 1,
        duration: 0.3,
      }
    );
    gsap.to(".menu-top-text", {
      y: "-1vw",
      duration: 0.3,
    });
  };

  const handleProjectCross = () => {
    if (!hasAnimated2) {
      setHasAnimated2(true);
      setTimeout(() => setHasAnimated2(false), 500);
    }
    gsap.fromTo(
      ".project-below-text",
      {
        y: "1vw",
        opacity: 0,
      },
      {
        y: "0vw",
        opacity: 1,
        duration: 0.3,
      }
    );
    gsap.to(".project-top-text", {
      y: "-1vw",
      duration: 0.3,
    });
  };

  const leaveNav = () => {
    gsap.to(".menu-top-text", { y: "0vw", duration: 0, ease: "linear" });
    gsap.to(".menu-below-text", { y: "1vw", duration: 0, ease: "linear" });
  };

  const handleProjectEnter = () => {
    gsap.fromTo(
      ".project-below-text",
      {
        y: "2vw",
        opacity: 0,
      },
      {
        y: "0vw",
        opacity: 1,
        duration: 0.3,
      }
    );
    gsap.to(".project-top-text", {
      y: "-2vw",
      duration: 0.3,
    });
  };

  const LeaveProjectHover = () => {
    gsap.to(".project-top-text", { y: "0vw", duration: 0, ease: "linear" });
    gsap.to(".project-below-text", { y: "2vw", duration: 0, ease: "linear" });
  };

  const handleEnter = () => {
  const lines = gsap.utils.toArray('.project-line');
  
 
  
  gsap.fromTo(
    lines,
    { scaleX: 1 },
    {
      scaleX: 0,
      duration: 0.25,
      stagger: 0.05,
      ease: "power2.inOut",
      transformOrigin: "left",
      onComplete: () => {
        gsap.to(lines, {
          scaleX: 1,
          duration:1,
          stagger: 0.05,
          ease: "power2.inOut",
          transformOrigin: "left",
        });
      },
    }
  );
};
    

  return (
    <div id="navbar-over" className="space-y-0">
      <div className="w-full flex  origin-top nav-menu-item-first justify-center fixed top-0 z-9999 pt-[1vw] h-[2vw] mix-blend-exclusion invert">
        <Image
          src="/assets/svg/icon-logo.svg"
          alt="logo"
          width={500}
          height={500}
          className="object-contain "
        />
      </div>

      <nav
        id="navv"
        className="fixed top-0 left-0 right-0 w-full h-[3vw] flex items-start justify-between z-9999"
      >
        {/* Left - Menu */}
        <button
          onClick={() => {
            if (projectOpen) setProjectOpen(false);
            setMenuOpen(!menuOpen);
          }}
          onMouseEnter={handleMenuHover}
          // onMouseLeave={leaveNav}
          className={`flex  overflow-hidden  nav-menu-item items-center  gap-[1.5vw] cursor-pointer outline-none bg-yellow px-[1.5vw] h-full py-[1vw] rounded-br-[1vw]   z-10000 relative ${menuOpen? '': 'group'}`}
        >
          <div className="flex flex-col w-[1vw] justify-start gap-[0.2vw] relative group cursor-pointer">
            <span
              className={`block h-px  bg-black transform origin-left ease-in-out transition-transform duration-100 ${
                hasAnimated ? "scale-x-0" : "scale-x-100"
              } ${
                menuOpen
                  ? "rotate-45 translate-y-[-0.09vw] w-[50%] "
                  : "rotate-0 translate-y-0 w-full"
              }`}
            ></span>

            <span
              className={`block h-px  bg-black transform origin-left ease-in-out transition-transform duration-500 delay-100 ${
                hasAnimated ? "scale-x-0" : "scale-x-100"
              } ${
                menuOpen
                  ? "-rotate-45  w-[50%]"
                  : "rotate-0 translate-y-0 w-full"
              }`}
            ></span>
          </div>
          <div className={`relative  flex justify-center items-start h-[1vw] w-[2.5vw] overflow-hidden ${menuOpen? 'group': ''}`}>
         {!menuOpen ? (
  
   
      <div className="w-fit px-[0.1vw] flex flex-col group-hover:translate-y-[-1.25vw] group-hover:transition-all group-hover:duration-300 gap-[0.2vw] items-center justify-center">
        <div className="project-top-text w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">
            MENU
          </span>
        </div>
        <div className="project-top-text group-hover:transition-all group-hover:duration-300 w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">
            MENU
          </span>
        </div>
      </div>

  ) : (
  
    <div  className="absolute top-1/2 left-1/2  !w-[7vw] h-[1vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
      <div className="w-fit mx-auto px-[0.1vw] flex flex-col group-hover:translate-y-[-1.25vw] group-hover:transition-all group-hover:duration-300 gap-[0.2vw] items-center justify-center">
        <div className="project-top-text w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">CLOSE</span>
        </div>
        <div className="project-top-text group-hover:transition-all group-hover:duration-300 w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">CLOSE</span>
        </div>

       
       
      </div>

    </div>

      
  )}
  </div>
        </button>

        {/* Right - Got a Project */}
      <button
  disabled={menuOpen}
  onClick={() => {
    if (menuOpen) setMenuOpen(false);
    setProjectOpen(!projectOpen);
  }}
  className={`relative nav-menu-item  flex flex-col items-center overflow-hidden justify-center  cursor-pointer outline-none bg-yellow px-[1vw] h-full py-[1vw] rounded-bl-[1vw]   ${
    menuOpen ? "z-9995" : "z-10002 group"
  }`}
>
   <div onMouseEnter={handleMenuHover} className="relative  w-[7vw] flex justify-center items-start h-[1vw] overflow-hidden">

 
  {!projectOpen ? (
  
   
      <div className="w-fit px-[0.1vw] flex flex-col group-hover:translate-y-[-1.25vw] group-hover:transition-all group-hover:duration-300 gap-[0.2vw] items-center justify-center">
        <div className="project-top-text w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">
            LAUNCH APP
          </span>
        </div>
        <div className="project-top-text group-hover:transition-all group-hover:duration-300 w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">
            LAUNCH APP
          </span>
        </div>
      </div>

  ) : (
  
    <div  className="absolute top-1/2 left-1/2 group w-[7vw] h-[1vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
      <div className="w-fit mx-auto px-[0.1vw] flex flex-col group-hover:translate-y-[-1.25vw] group-hover:transition-all group-hover:duration-300 gap-[0.2vw] items-center justify-center">
        <div className="project-top-text w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">CLOSE</span>
        </div>
        <div className="project-top-text group-hover:transition-all group-hover:duration-300 w-full h-full flex items-center justify-center overflow-hidden">
          <span className="font-body text-[0.7vw] font-semibold text-black">CLOSE</span>
        </div>

       
       
      </div>

    </div>
      
  )}
     <div 
          className={`w-fit flex justify- items-center absolute group duration-300 ease-in-out -translate-y-1/2 -translate-x-1/2 top-1/2 right-0 ${
            projectOpen
              ? " opacity-100"
              : "opacity-0  "
          }`}
          
        >

          <div className="flex flex-col w-[1vw] justify-start gap-[0.2vw] relative group  cursor-pointer">
            <span
              className={`block h-px  bg-black transform origin-left ease-in-out transition-transform duration-500 ${
                hasAnimated ? "scale-x-0" : "scale-x-100"
              } rotate-45 translate-y-[-0.09vw] w-[50%]`}
            ></span>

            <span
              className={`block h-px  bg-black transform origin-left ease-in-out transition-transform duration-500 delay-100 ${
                hasAnimated ? "scale-x-0" : "scale-x-100"
              } -rotate-45  w-[50%]`}
            ></span>
          </div>
         
        </div>
      </div>
  

</button>


        {/* MENU OVERLAY */}

        <div
          ref={menuOverlayRef}
          className="fixed top-0 left-0 z-[9999] w-[128vw] h-[125vh] rounded-br-full overflow-hidden "
          style={{ clipPath: "circle(0% at 0% 0%)" }}
        >
          {" "}
          <div
            className={` w-full h-full navbar-clip-path transition-all duration-700 ${
              menuOpen ? "pointer-events-auto" : "pointer-events-none"
            } origin-top-left`}
          >
            <div
              className={`flex flex-col items-end justify-end origin-left mr-[29vw] pb-[15vw] h-full text-center space-y-6  ${
                menuOpen ? "opacity-100 delay" : "opacity-100"
              }`}
            >
              <div className="font-medium text-right  flex flex-col items-end justify-end">
                {navItems.map((item, i) => (
                  <p
                    key={i}
                    className={`leading-none w-fit h-fit  text-right! transition-opacity ease-in-out duration-300 ${
                      hoveredIndex !== null && hoveredIndex !== i
                        ? "opacity-50"
                        : "opacity-100"
                    }`}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <Link
                      href={item.href}
                      className="font-third text-[4vw] text-right origin-right cursor-pointer transition-colors duration-300"
                    >
                      {item.title}
                    </Link>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PROJECT OVERLAY */}
        <div
          ref={projectWrapperRef}
          className="fixed top-0 right-0 z-10001 w-[130vw] h-[135vh] rounded-bl-full overflow-hidden"
          style={{
            clipPath: "circle(0% at 100% 0%)",
          }}
          onMouseMove={handleProjectHover}
        >
          <div
            ref={projectOverlayRef}
            className={` bg-yellow w-full h-screen ${
              projectOpen ? "pointer-events-auto z-0" : "pointer-events-none"
            }`}
          >
            <div className="h-[100%] w-full px-[2vw] flex ">
              <div className="w-[55%] flex flex-col items-end justify-center">
                <div className="w-[40%] cursor-pointer">
                  <p className="text-[1.8vw]  leading-[1.2]]  font-display pb-[2vw]">
                    Get Started
                  </p>

                  <div className="w-[28vw] space-y-[2vw]">
                    <div className="group">
                      <p className="text-[4vw]  relative tracking-tighter  leading-[1.1] font-third ">
                        Ready to trade
                        <span className="absolute bottom-0 scale-x-0 transition-all ease-out duration-1000 origin-left group-hover:scale-x-100 left-0 w-full h-[0.2px] bg-black"></span>
                      </p>
                      <p className="text-[4vw] tracking-tighter w-fit relative  leading-[1.1]  font-third ">
                        attention?
                        <span className="absolute bottom-0 scale-x-0 transition-all ease-out duration-1000 origin-left group-hover:scale-x-100 left-0 w-full h-[0.2px] bg-black"></span>
                      </p>
                    </div>
                    <p className="text-[1.3vw] w-[80%] font-medium  leading-[1.3]">
                      Connect your wallet or sign in with email. Start trading mindshare in seconds.
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-[45%] flex flex-col items-end justify-center">
                <div className="w-[70%] cursor-pointer">
                  <p className="text-[1.8vw] leading-none  font-display pb-[2vw]">
                    Create a Market
                  </p>

                  <div className="w-[33vw]   space-y-[2vw]">
                    <div className="group">
                      <p className="text-[4vw]  relative  leading-[1.1] tracking-tighter  font-third font ">
                        Want to create
                        <span className="absolute bottom-0 scale-x-0 transition-all ease-in-out duration-400 origin-left group-hover:scale-x-100 left-0 w-full h-[0.2px] bg-black"></span>
                      </p>
                      <p className="text-[4vw] w-fit relative  leading-[1.1] tracking-tighter font-third ">
                        a market?
                        <span className="absolute bottom-0 scale-x-0 transition-all ease-in-out duration-400 origin-left group-hover:scale-x-100 left-0 w-full h-[0.2px] bg-black"></span>
                      </p>
                    </div>
                    <p className="text-[1.3vw] w-[80%] font-medium  leading-[1.3]">
                      Paste any social link and we'll extract the asset and spawn a market instantly.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLACK OVERLAY for MENU */}
        <div
          className={`fixed inset-0 bg-black  transition-opacity duration-700 ${
            menuOpen ? "opacity-60" : "opacity-0"
          } pointer-events-none z-[9998]`}
        ></div>

        {/* BLACK OVERLAY for PROJECT (higher z-index) */}
        <div
          className={`fixed inset-0 bg-black transition-opacity duration-700 ${
            projectOpen
              ? "opacity-60 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          } z-[10000]`}
        ></div>
      </nav>
    </div>
  );
}
