import Link from 'next/link'
import React from 'react'

const MobileBtn = ({bgColor='bg-white', text='hello', href='/'}) => {
  return (
    <Link href={href} className={`w-fit rounded-md overflow-hidden`}>
      
            <p className={`${bgColor} w-fit px-4 py-2 rounded-md font-semibold`}>
                {text}
            </p>
       
    </Link>
  )
}

export default MobileBtn