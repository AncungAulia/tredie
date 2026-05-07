import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

const MobileIconButton = ({bgColor='bg-white', size='6vw', icon, href='/'}) => {
  return (
    <Link href={href}>
    <div className={`${bgColor} w-[${size}] h-[${size}]`}>

        <Image src={icon} width={200} height={200} alt='icon' className='w-full h-full ' />

    </div>
        
    </Link>
  )
}

export default MobileIconButton