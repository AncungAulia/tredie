import React from 'react';
import Image from 'next/image';
import IconButton from '../button/IconButton';

const categoriesData = [
  {
    id: "01",
    category: "Trends",
    title: "If it's blowing up on social, it's already tradeable here.",
    backgroundColor: "bg-[#7B6ED8]",
    textColor: "text-[#F3EFEB]",
    description:
      "Tredie scans X, Telegram, and on-chain data in real time. The moment a token starts trending, a market is live. Fully on-chain, in seconds. No gatekeepers.",
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80",
    cta: "Start Trading",
  },
  {
    id: "02",
    category: "Attention",
    backgroundColor: "bg-[#4C4496]",
    textColor: "text-[#F3EFEB]",
    title: "Attention is the alpha. Buy the signal before the crowd arrives.",
    description:
      "Every spike in social volume is a trade waiting to happen. Tredie quantifies mindshare: sentiment velocity, mention counts, momentum. Buy before the crowd prices it in.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
    cta: "View Signals",
  },
  {
    id: "03",
    category: "Realtime AI",
    backgroundColor: "bg-[#281F5E]",
    textColor: "text-[#F3EFEB]",
    title: "Elfa AI reads the room. You just have to trade it.",
    description:
      "Powered by Elfa AI, Tredie surfaces emerging narratives before they peak. Trend scores, sentiment analysis, confidence signals. All streaming in real time.",
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80",
    cta: "See AI Signals",
  },
  {
    id: "04",
    category: "Trending CAs",
    backgroundColor: "bg-[#110F28]",
    textColor: "text-[#F3EFEB]",
    title: "X is buzzing, TG is pumping. The market is already spawned.",
    description:
      "Tredie tracks contract addresses going viral on X and Telegram via Elfa AI. The moment a CA starts moving, we spin up a tradeable market automatically, on-chain.",
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80",
    cta: "Find Markets",
  },
];

const MobileCategories = () => {
  return (
    <div className="flex flex-col">
      {categoriesData.map((item) => (
        <div
          key={item.id}
          className={`${item.backgroundColor} min-h-screen flex flex-col px-6 py-8`}
        >
          {/* Header */}
          <div className="mb-10">
            <h2 className={`text-6xl font-third ${item.textColor} mb-4`}>{item.category}</h2>
            <div className="flex items-start justify-between gap-4">
              <span className={`text-5xl ${item.textColor} opacity-20 w-[20%] font-third`}>{item.id}</span>
              <p className={`text-2xl font-display pt-2 w-[73%] leading-[1.2] ${item.textColor}`}>
                {item.title}
              </p>
            </div>
          </div>

          {/* Image */}
          <div className="flex items-start justify-end mb-10">
            <div className="w-[75%]">
              <Image
                src={item.image}
                alt={item.category}
                width={600}
                height={400}
                className="w-full h-64 object-cover rounded-2xl shadow-lg"
              />
            </div>
          </div>

          {/* Description */}
          <p className={`text-lg leading-[1.4] mb-10 max-w-md ${item.textColor} opacity-70`}>
            {item.description}
          </p>

          {/* CTA */}
          <button className="flex items-center gap-4 text-base font-semibold group">
            <span className={`text-2xl font-semibold ${item.textColor}`}>{item.cta}</span>
            <div className="p-3 bg-white/20 rounded-md h-10 w-10">
              <Image src='/assets/icons/icon-arrow.svg' alt='icon-arrow' className='h-full w-full' width={300} height={300} />
            </div>
          </button>
        </div>
      ))}
    </div>
  );
};

export default MobileCategories;