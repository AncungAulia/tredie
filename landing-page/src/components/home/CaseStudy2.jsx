'use client'
import React, { useEffect, useState } from 'react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/dist/ScrollTrigger'
import SplitText from 'gsap/dist/SplitText'
import IconButton from '../button/IconButton'
import Btn from '../button/Btn'
gsap.registerPlugin(ScrollTrigger, SplitText)

const CaseStudy2 = () => {
  const slides = [
    {
      ticker: 'BONK',
      assetClass: 'Meme Coin',
      marketType: 'Trend Auto-Spawn',
      network: 'Solana',
      quote: `"BONK was spiking on every X feed. Tredie had the market live before any CEX touched it. Bought at 1.0x floor. Locked in at 3.2x after the second wave."`,
      name: "Crypto Trader",
      org: "Tredie Community",
      logo: "/assets/img/party-1.jpeg",
      image: "/assets/img/party-2.jpeg",
    },
    {
      ticker: 'WIF',
      assetClass: 'Meme Token',
      marketType: 'Mindshare Spike',
      network: 'Solana',
      quote: `"WIF was all over Telegram. Elfa AI scored the spike and spawned the market in under 30 seconds. Floor tripled before most traders heard about it."`,
      name: "DeFi Trader",
      org: "Early Adopter",
      logo: "/assets/img/party-2.jpeg",
      image: "/assets/img/party-1.jpeg",
    },
    {
      ticker: 'AAPL',
      assetClass: 'Tokenized Equity',
      marketType: 'Mindshare Event',
      network: 'Solana',
      quote: `"Apple keynote trended globally. Tredie's curve priced in the mindshare instantly. On-chain, 24/7, no waiting for a CEX to open."`,
      name: "Equity Trader",
      org: "Tredie Community",
      logo: "/assets/img/party-1.jpeg",
      image: "/assets/img/party-2.jpeg",
    },
  ]

  const [current, setCurrent] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

 
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set('.case-study-container', {
        clipPath:
          'polygon(100% 50%, 0% 50%, 0% 50%, 0% 50%, 0% 50%, 0% 50%)',
        yPercent: -10,
      })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#casee-study',
          start: 'top 50%',
          end: '55% 50%',
          scrub: true,
          // markers:true,
          invalidateOnRefresh: true,
        },
      })

      tl.fromTo(
        '.case-study-container',
        { yPercent: -10 },
        { yPercent: 0, ease: 'linear', duration: 1 }
      )
        .to(
          '.case-study-container',
          {
            clipPath:
              'polygon(100% 50%, 0% 0%, 0% 0%, 0% 48%, 0% 100%, 0% 100%)',
            ease: 'linear',
            duration: 1,
          },
          '<'
        )
        .to('.case-study-container', {
          clipPath:
            'polygon(100% 50%, 100% 0%, 0% 0%, 0% 48%, 0% 100%, 100% 100%)',
          ease: 'linear',
          duration: 1,
        })
    })

    return () => ctx.revert()
  }, [])

  
  const animateTextIn = () => {
    const split = new SplitText('.slider-content', {
      type: 'lines',
      linesClass: 'line',
      mask: 'lines',
    })

    gsap.set(split.lines, { yPercent: 100, opacity: 0 })

    gsap.to(split.lines, {
      yPercent: 0,
      opacity: 1,
      stagger: 0.04,
      duration: 0.4,
      ease: 'power2.out',
    })

    // Fade in image
    gsap.fromTo(
      '.slider-image',
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out' }
    )
  }

  const animateSlideChange = (direction) => {
    if (isAnimating) return
    setIsAnimating(true)

    const oldSplit = new SplitText('.slider-content', {
      type: 'lines',
      linesClass: 'line',
      mask: 'lines',
    })

    const tl = gsap.timeline({
      onComplete: () => {
        setCurrent((prev) =>
          direction === 'next'
            ? (prev + 1) % slides.length
            : (prev - 1 + slides.length) % slides.length
        )
      },
    })

    tl.to(oldSplit.lines, {
      yPercent: -100,
      opacity: 0,
      stagger: 0.04,
      duration: 0.4,
      ease: 'power2.inOut',
    }).to(
      '.slider-image',
      {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.inOut',
      },
      '<'
    )
  }

  useEffect(() => {
    const ctx = gsap.context(() => {
      animateTextIn()
    })

    const timeout = setTimeout(() => setIsAnimating(false), 800)
    return () => {
      ctx.revert()
      clearTimeout(timeout)
    }
  }, [current])

  return (
    <section id='casee-study' className='relative h-[150vh] z-0 bg-white'>
      <style jsx>{`
        .line {
          overflow: hidden;
          display: block;
        }
      `}</style>

      <div className='sticky top-0 h-screen w-full overflow-hidden'>
        <div className='case-study-container h-full w-full bg-[#FFFFFF] text-black flex flex-col justify-between px-[2vw] py-[4vh]'>


          
          {/* HEADER */}
          <div className='grid grid-cols-4 gap-[3vw] text-[0.8vw] uppercase tracking-[0.1vw] mb-[4vh]'>
            <div>
              <p className='opacity-60'>Ticker</p>
              <p key={`quote-${current}`} className='text-[1vw] font-medium slider-content'>
                {slides[current].ticker}
              </p>
            </div>
            <div>
              <p className='opacity-60'>Asset Class</p>
              <p key={`quote-${current}`} className='text-[1vw] font-medium slider-content'>
                {slides[current].assetClass}
              </p>
            </div>
            <div>
              <p className='opacity-60'>Market Type</p>
              <p key={`quote-${current}`} className='text-[1vw] font-medium slider-content'>
                {slides[current].marketType}
              </p>
            </div>
            <div>
              <p className='opacity-60'>Network</p>
              <p key={`quote-${current}`} className='text-[1vw] font-medium slider-content'>
                {slides[current].network}
              </p>
            </div>
          </div>

          {/* MAIN SLIDE CONTENT */}
          <div key={`quote-${current}`} className='flex justify-between items-center h-full'>
            <div className='w-[35%] slider-content text-[2.5vw] leading-[1.1] font-display'>
              {slides[current].quote}
            </div>

            <div className='flex justify-center items-center gap-[8vw] w-[60%]'>
              <div className='text-center w-[50%]'>
                <p className='font-semibold slider-content text-[1vw]'>
                  {slides[current].name}
                </p>
                <p className='text-[0.9vw] slider-content opacity-70'>
                  {slides[current].org}
                </p>
              </div>

              <div className='w-[50%]'>
                <img
                  src={slides[current].image}
                  alt='slide visual'
                  className='w-[10vw] h-[10vw] object-cover rounded-[1vw] slider-image'
                />
              </div>
            </div>
          </div>

          {/* CONTROLS */}
          <div className='flex justify-between items-center mt-[3vh] text-[0.8vw]'>
            <div className='flex gap-[1vw]'>
              <div onClick={() => animateSlideChange('prev')}>
                <IconButton icon='/assets/icons/prev-icon.svg' pad='w-[3.5vw] h-[3.5vw] ' />
              </div>
              <div onClick={() => animateSlideChange('next')}>
                <IconButton icon='/assets/icons/next-icon.svg' pad='w-[3.5vw] h-[3.5vw]' />
              </div>
            </div>

            <div className='text-sm text-gray-500  w-[4vw] flex gap-[0.3vw] font-display tracking-widest'>
              <span key={`quote-${current}`} className='slider-content w-[40%]'>
                {String(current + 1).padStart(2, '0')}
              </span>
              <span className='w-[60%]'>/ {String(slides.length).padStart(2, '0')}</span>
            </div>

            <div>
              <Btn text='Open Market' />
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

export default CaseStudy2
