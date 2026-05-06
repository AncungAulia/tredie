import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';

const statsData = [
  {
    number: "270+",
    heading: "Projects Delievered",
    content: "Big stages, small details. Each one designed to leave a mark.",
    image: "/assets/img/about-bg.jpeg"
  },
  {
    number: "90%",
    heading: "Loyal Client",
    content: "Our clients love to come back, proof that true partnership lasts.",
    image: "/assets/img/about-bg-2.jpeg"
  },
  {
    number: "21",
    heading: "Team Nationalities",
    content: "One team. Twenty-one perspectives. Countless cultural insights.",
    image: "/assets/img/about-bg-3.jpeg"
  },
  {
    number: "30",
    heading: "Countries Reached",
    content: "We don't just go global. We bring the world to every event.",
    image: "/assets/img/about-bg-4.jpeg"
  },
  {
    number: "1.2K",
    heading: "Lightbulb moments",
    content: "That's ideas, not coffee. Brilliant ones, brewed daily.",
    image: "/assets/img/about-bg-5.jpeg"
  }
];

const MobileStats = () => {
  const [progress, setProgress] = React.useState(0);

  const handleSlideChange = (swiper) => {
    const progressValue = ((swiper.activeIndex + 1) / statsData.length) * 100;
    setProgress(progressValue);
  };

  return (
    <div className="w-full bg-white py-8 h-[80vh] mr-0 mt-20 ">

        <p className='text-[5vw] font-display mx-2'>
            Where passion meets precision
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