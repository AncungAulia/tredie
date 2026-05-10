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
      "Tredie watches X and Telegram in real time. The moment something starts trending, you can trade it. In seconds. No middlemen.",
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=800&q=80",
    cta: "Start Trading",
  },
  {
    id: "02",
    category: "Attention",
    backgroundColor: "bg-[#4C4496]",
    textColor: "text-[#F3EFEB]",
    title: "Popularity drives price. Get in before everyone else does.",
    description:
      "When something starts getting talked about, the price follows. Tredie tracks how fast buzz is growing so you can buy in before the crowd pushes the price up.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80",
    cta: "View Signals",
  },
  {
    id: "03",
    category: "Realtime AI",
    backgroundColor: "bg-[#281F5E]",
    textColor: "text-[#F3EFEB]",
    title: "We watch what people talk about. You just have to trade it.",
    description:
      "Tredie uses Elfa AI to spot what is starting to blow up online before it goes mainstream. Updated continuously, so you always see what is moving right now.",
    image: "/assets/img/elfa-ai-logo.png",
    cta: "See AI Signals",
  },
  {
    id: "04",
    category: "Trending CAs",
    backgroundColor: "bg-[#110F28]",
    textColor: "text-[#F3EFEB]",
    title: "When it blows up on X and Telegram, the market is already open.",
    description:
      "Tredie watches tokens going viral on X and Telegram. The moment one starts moving, we open a market automatically. No waiting.",
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