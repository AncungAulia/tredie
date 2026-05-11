import Image from 'next/image'
import React from 'react'

const MobileQuoteContact = () => {
  return (
    <section className='relative h-screen w-full'>
        <Image src='https://res.cloudinary.com/ddzibjaqg/image/upload/v1778532226/WhatsApp_Image_2026-05-12_at_03.43.31_dwoiop.jpg' height={1000} width={1000} alt='img' className='h-full w-full object-cover' />
        <div className='absolute top-0 z-10 w-full text-[15vw] h-screen flex items-center flex-col justify-center gap-24'>
            <p className='font-third text-white relative'>
                LAUNCH
                <span className='absolute z-15 bottom-2 left-0 w-[42vw] bg-[#9C93E8] h-[1px]'/>
            </p>

            
            </div>
    </section>
  )
}

export default MobileQuoteContact