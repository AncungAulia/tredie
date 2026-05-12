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
      ticker: 'BTC',
      assetClass: 'Crypto',
      marketType: 'Social Spike',
      network: 'Solana',
      quote: `"BTC was all over my feed that morning before the charts moved. Felt like something was happening before it happened. Got in while it was still quiet."`,
      image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778527448/Topics_trend_every_day_o8mytv.png",
    },
    {
      ticker: 'HANTA',
      assetClass: 'Topic',
      marketType: 'News Cycle',
      network: 'Solana',
      quote: `"I had no idea what hantavirus actually was. It was just the top trending topic on X for three hours straight. That felt like a signal. Opened a position. It was."`,
      image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778499766/hantavirus1_aivmoq.avif",
    },
    {
      ticker: 'AAPL',
      assetClass: 'Equity',
      marketType: 'Live Event',
      network: 'Solana',
      quote: `"I was watching the Apple keynote and opened Tredie before it was over. The attention was obvious. The price agreed."`,
      image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778529755/Apple_keynote_kwxgrp.jpg",
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
          <div key={`quote-${current}`} className='flex flex-1 items-stretch gap-[3vw]'>
            <div className='w-[42%] flex items-center slider-content text-[2.5vw] leading-[1.1] font-display'>
              {slides[current].quote}
            </div>

            <div className='flex-1 flex items-center justify-center'>
              <img
                src={slides[current].image}
                alt='slide visual'
                className='w-full h-[55vh] object-cover rounded-[1.5vw] slider-image'
              />
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
