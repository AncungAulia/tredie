import Image from 'next/image'
import React from 'react'

const MobileQuoteContact = () => {
  return (
    <section className='relative h-screen w-full'>
      <Image
        src='https://res.cloudinary.com/ddzibjaqg/image/upload/v1778530402/Screenshot_2026-05-12_at_03.13.12_lyhxdq.png'
        height={1000}
        width={1000}
        alt='img'
        className='h-full w-full object-cover blur-[8px] scale-105'
      />
      {/* Gradient overlay: spotlight effect for the center text */}
      <div className='absolute inset-0 bg-gradient-to-b from-transparent via-black/1p to-transparent z-[5]' />
      <div className='absolute top-0 z-10 w-full h-screen flex items-center flex-col justify-center gap-8 px-[8vw]'>
        <p className='font-third text-[#9C93E8] text-[15vw] relative'>
          LAUNCH
          <span className='absolute z-15 bottom-2 left-0 w-[42vw] bg-[#9C93E8] h-[1px]' />
        </p>

        <p className='font-third text-white text-[6.5vw] text-center leading-[1.2]'>
          Ready to launch and trade?
        </p>

        <p className='text-white/80 text-[4vw] text-center leading-[1.5]'>
          Something is trending right now. A market for it is already open on Tredie.
        </p>

        <a
          href='https://app.tredie.fun'
          target='_blank'
          rel='noopener noreferrer'
          className='mt-2 bg-[#9C93E8] text-black font-semibold font-display uppercase text-[3.5vw] tracking-widest px-[8vw] py-[4vw] rounded-full'
        >
          Launch App
        </a>
      </div>
    </section>
  )
}

export default MobileQuoteContact
