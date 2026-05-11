import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

const statsData = [
  {
    number: "5",
    heading: "5 Asset Classes",
    content: "Crypto, equities, commodities, FX, and topics. If attention moved it, you can trade it here.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778530402/Screenshot_2026-05-12_at_03.13.12_lyhxdq.png"
  },
  {
    number: "15min",
    heading: "Updates Every 15 Minutes",
    content: "Elfa AI reads X and Telegram every 15 minutes. When the conversation shifts, price curves shift with it.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778531004/elfaai15_gnlw6j.jpg"
  },
  {
    number: "30s",
    heading: "Opens in 30 Seconds",
    content: "When a topic starts gaining traction, a market opens automatically. No one has to list it.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778531194/marketopens_ol3suq.webp"
  },
  {
    number: "0",
    heading: "The Market Listed Itself",
    content: "There is no listing process. Elfa AI detects what's trending and opens a market for it automatically. Nobody submitted it. Nobody approved it.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778531483/elfaaiauto_neohsy.jpg"
  },
  {
    number: "$200K",
    heading: "First 30 Minutes",
    content: "The first market on Tredie cleared $200K in volume before most people knew it existed.",
    image: "https://res.cloudinary.com/ddzibjaqg/image/upload/v1778496268/Solana_Perpetuals_ckftdk.jpg"
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
                <div className="text-[25vw] font-third text-gray-900 mb-2 h-[28vw] flex items-center leading-none overflow-hidden">
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