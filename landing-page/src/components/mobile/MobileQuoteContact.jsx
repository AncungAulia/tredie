import Image from 'next/image'
import React from 'react'

const MobileQuoteContact = () => {
  return (
    <section className='relative h-screen w-full'>
        <Image src='/assets/img/party-2.jpeg' height={1000} width={1000} alt='img' className='h-full w-full object-cover' />
        <div className='absolute top-0 z-10 w-full text-[15vw] h-screen flex items-center flex-col justify-center gap-24'>
            <p className='font-third text-yellow relative'>
                Quote
                <span className='absolute z-15 bottom-2 left-0 w-[42vw] bg-yellow h-[1px]'/>
            </p>

            <p className='font-third text-yellow relative'>
                Contact
                <span className='absolute z-15 bottom-2 left-0 w-[53vw] bg-yellow h-[1px]'/>
            </p>
            
            </div>
    </section>
  )
}

export default MobileQuoteContact