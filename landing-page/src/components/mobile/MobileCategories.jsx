import React from 'react';
import Image from 'next/image';
import IconButton from '../button/IconButton';

const categoriesData = [
  {
    id: "01",
    category: "Topics",
    title: "Topics trend every day. Most of that attention had nowhere to go.",
    backgroundColor: "bg-[#7B6ED8]",
    textColor: "text-[#F3EFEB]",
    description:
      "When a topic starts gaining traction on X or Telegram, a market opens for it on Tredie. You trade the conversation, not a derivative of it.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778527448/Topics_trend_every_day_o8mytv.png",
    cta: "Start Trading",
  },
  {
    id: "02",
    category: "Attention",
    backgroundColor: "bg-[#4C4496]",
    textColor: "text-[#F3EFEB]",
    title: "Attention has always moved prices. It never had a price of its own.",
    description:
      "On Tredie, each market's price reflects the attention a topic is getting. When social interest grows, the price floor moves with it. You can see where the conversation is going before the price gets there.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778528025/WhatsApp_Image_2026-05-12_at_02.33.33_shenyh.jpg",
    cta: "View Signals",
  },
  {
    id: "03",
    category: "Signal",
    backgroundColor: "bg-[#281F5E]",
    textColor: "text-[#F3EFEB]",
    title: "By the time it's in the news, the interesting trade already happened.",
    description:
      "Tredie surfaces what's gaining traction on X and Telegram before it becomes mainstream. The feed shows what the internet is watching right now, not yesterday.",
    image: "/assets/img/elfa-ai-logo.png",
    cta: "See What's Trending",
  },
  {
    id: "04",
    category: "Tokens",
    backgroundColor: "bg-[#110F28]",
    textColor: "text-[#F3EFEB]",
    title: "A token went viral on X this week. Its market was already live.",
    description:
      "Tokens gaining traction on X and Telegram get markets automatically on Tredie. Not after someone notices. The moment attention builds.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778529329/tokenstredie_y24ocf.jpg",
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


        </div>
      ))}
    </div>
  );
};

export default MobileCategories;