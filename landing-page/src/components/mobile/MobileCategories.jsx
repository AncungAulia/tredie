import React from 'react';
import Image from 'next/image';
import IconButton from '../button/IconButton';

const categoriesData = [
  {
    id: "01",
    category: "Events",
    title: "Global Events, Brand Activations, Experience Content",
    backgroundColor: "bg-[#F7FFDC]",
    description:
      "From corporate summits to viral moments, we create experiences that fuel alignment and connection between audiences and business goals.",
    image: "/assets/img/about-bg-2.jpeg",
    cta: "See what we create",
  },
  {
    id: "02",
    category: "Exhibits",
    backgroundColor: "bg-[#D1F3F5]",
    title: "Digital Campaigns, Social Media, Influencer Marketing",
    description:
      "We craft compelling digital narratives that resonate across platforms, building authentic connections between brands and their communities.",
    image: "/assets/img/about-bg.jpeg",
    cta: "Explore our work",
  },
  {
    id: "03",
    category: "Congresses",
    backgroundColor: "bg-[#DDD9FF]",
    title: "Product Launches, Experiential Retail, Pop-Up Experiences",
    description:
      "Transform product introductions into memorable moments that generate buzz and drive consumer engagement through innovative retail experiences.",
    image: "/assets/img/about-bg-3.jpeg",
    cta: "View our launches",
  },
  {
    id: "04",
    category: "Sports",
    backgroundColor: "bg-[#FFDDCA]",
    title: "Conferences, Trade Shows, B2B Engagement",
    description:
      "Elevate your presence at industry events with immersive booth experiences and strategic activations that convert connections into opportunities.",
    image: "/assets/img/about-bg-4.jpeg",
    cta: "Discover more",
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
          <div className="mb-15 ">
            <h2 className="text-6xl font-third text-neutral-800 mb-15">{item.category}</h2>
            <div className="flex items-start justify-between gap-4">
              <span className="text-5xl text-neutral-800 w-[20%] font-third">{item.id}</span>
              <p className="text-2xl font-display pt-2 w-[63%] leading-[1.2]">
                {item.title}
              </p>
            </div>
          </div>

          {/* Image */}
          <div className=" flex items-start justify-end mb-15">
            <div className="w-[70%] ">
              <img
                src={item.image}
                alt={item.category}
                className="w-full h-64 bg-black object-cover rounded-2xl shadow-lg"
              />
            </div>
          </div>

          {/* Description */}
          <p className="text-lg leading-[1.2] mb-15 max-w-md">
            {item.description}
          </p>

          {/* CTA */}
          <button className="flex items-center  gap-4 text-base font-semibold group">
            <span className='text-3xl text-neutral-900 font-semibold'>{item.cta}</span>
            <div className='p-3 bg-white rounded-md h-10 w-10'>

<Image src='/assets/icons/icon-arrow.svg' alt='icon-arrow' className='h-full w-full ' width={300} height={300} />
            </div>
          </button>
        </div>
      ))}
    </div>
  );
};

export default MobileCategories;