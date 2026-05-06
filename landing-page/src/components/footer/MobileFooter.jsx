import React from 'react';

import Image from 'next/image';
export default function MobileFooter() {
  return (
    <footer className="bg-neutral-900 text-white px-6 py-12">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-shrink-0">
            <Image
                          src="/assets/img/great-place-to-work.png"
                          width={500}
                          height={500}
                          alt="Great Place To Work"
                          className="w-[15vw] h-auto"
                        />
          </div>
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Trade the<br />Attention Economy
            </h2>
            <div className="space-y-1 text-sm">
          <p>Tredie Fun</p>
          <p>Solana Devnet</p>
          <p>Colosseum Frontier 2026</p>
          <p className="mt-4">solana.frontier@tredie.xyz</p>
        </div>
          </div>
        </div>
        
        
      </div>

      {/* Explore Section */}
      <div className="mb-12 flex justify-start gap-15">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4">
          EXPLORE
        </h3>
        <nav className="space-y-0 font-display ">
          <a href="#" className="block text-[6vw] ">Home</a>
          <a href="#" className="block text-[6vw] ">About</a>
          <a href="#" className="block text-[6vw] ">Markets</a>
          <a href="#" className="block text-[6vw] ">How It Works</a>
          <a href="#" className="block text-[6vw] ">Trending</a>
          <a href="#" className="block text-[6vw] ">Portfolio</a>
          <a href="#" className="block text-[6vw] ">Leaderboard</a>
          <a href="#" className="block text-[6vw] ">Docs</a>
          <a href="#" className="block text-[6vw] ">Contact</a>
        </nav>
      </div>

      {/* Connect Section */}
      <div className='flex gap-15 justify-start font-display'>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4">
          CONNECT
        </h3>
        <div className="space-y-1">
          <a href="#" className="block text-[6vw] ">LinkedIn</a>
          <a href="#" className="block text-[6vw] ">Instagram</a>
        </div>
      </div>
      <div className="flex flex-col w-full justify-end pt-8 items-end">
        <div className="space-y-2 text-xs mb-6">
          <p className="block ">COOKIE POLICY</p>
          <p className="block ">LEGAL NOTICE & TERMS OF USE</p>
          <p className="block ">PRIVACY POLICY</p>
        </div>
        
        
      </div>
      <div>
        <div className="mb-4">
          <Image src='/assets/svg/footer-mobil-logo.svg' width={500} height={500} alt='footer-logo' className='w-full h-auto text-yellow' />
        </div>
        
        <p className="text-xs w-fit mx-auto text-gray-200">
          COPYRIGHT © TREDIE 2026
        </p>
      </div>
    </footer>
  );
}