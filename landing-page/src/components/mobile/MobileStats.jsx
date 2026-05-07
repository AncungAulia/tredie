import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

const statsData = [
  {
    number: "5",
    heading: "Asset Classes",
    content: "Crypto, tokenized equities, commodities, FX, and DEX tokens. One platform for all of it.",
    image: "https://images.unsplash.com/photo-1642790551116-18e150f248e3?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "15min",
    heading: "Oracle Cadence",
    content: "Elfa AI re-scores real social mindshare every 15 minutes. The curve stays current, not stale.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "30s",
    heading: "Market Spawn Time",
    content: "Elfa Auto detects a mindshare spike. A market is live on-chain. No manual work, no waiting.",
    image: "https://images.unsplash.com/photo-1618044619888-009e412ff12a?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "1way",
    heading: "Floor Direction",
    content: "Attention growth permanently raises the price floor. It never comes back down. The curve has memory.",
    image: "https://images.unsplash.com/photo-1605792657660-596af9009e82?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "$200K",
    heading: "In 30 Minutes",
    content: "What Zora drew in their first 30 minutes on Solana. The market wants this. We built what they couldn't.",
    image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80"
  }
];

const MobileStats = () => {
  const [progress, setProgress] = React.useState(0);

  const handleSlideChange = (swiper) => {
    const progressValue = ((swiper.activeIndex + 1) / statsData.length) * 100;
    setProgress(progressValue);
  };

  return (
    <div className="w-full bg-[#9C93E8] py-8 h-[80vh] mr-0 mt-20 ">

        <p className='text-[5vw] font-display mx-2'>
            Attention has a price. Now it has a market.
        </p>
      <Swiper
        modules={[]}
        spaceBetween={16}
        slidesPerView={1.2}
        centeredSlides={false}
        onSlideChange={handleSlideChange}
        onSwiper={(swiper) => handleSlideChange(swiper)}
        className="!px-2 mt-5"
      >
        {statsData.map((stat, index) => (
          <SwiperSlide key={index}>
            <div className="bg-white rounded-lg overflow-hidden">
                <div className="text-[25vw] font-third text-gray-900 mb-2">
                  {stat.number}
                </div>
              {/* Image Section */}

              <div className="relative h-[23vh] w-full rounded-xl overflow-hidden">
                <img
                  src={stat.image}
                  alt={stat.heading}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Content Section */}
              <div className="p-4">
                {/* Number */}
                
                
                {/* Heading */}
                <h3 className="text-[7vw] leadng-none text-nowrap font-semibold text-gray-900 mb-5">
                  {stat.heading}
                </h3>
                
                {/* Description */}
                <p className="text-[4vw] font-medium leading-[1.1]">
                  {stat.content}
                </p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Progress Bar */}
      <div className="px-4 mt-6">
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gray-900 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default MobileStats;