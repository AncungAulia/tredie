import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

const statsData = [
  {
    number: "5",
    heading: "What You Can Trade",
    content: "Crypto, stocks, gold, and currencies. All on one platform, no matter what is trending.",
    image: "https://images.unsplash.com/photo-1642790551116-18e150f248e3?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "15min",
    heading: "Always Up to Date",
    content: "Every 15 minutes, we check what people are talking about and update prices to match.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "30s",
    heading: "Ready in Seconds",
    content: "The moment something starts trending, you can already trade it. It happens automatically.",
    image: "https://images.unsplash.com/photo-1618044619888-009e412ff12a?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "1way",
    heading: "Prices Only Go Up",
    content: "Once a topic gets popular enough, its price goes up and stays there. It never drops back down.",
    image: "https://images.unsplash.com/photo-1605792657660-596af9009e82?auto=format&fit=crop&w=800&q=80"
  },
  {
    number: "$200K",
    heading: "In 30 Minutes",
    content: "The first market on Tredie did $200K in just 30 minutes. Real demand from real people.",
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