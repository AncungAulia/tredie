import React from "react";

const page = () => {
  return (
    <div>
      <div class="relative h-screen w-screen bg-gray-300 overflow-hidden">
        <div
          class="absolute top-[-25vw] right-0 w-[70%] triangle-clip  h-[65vw]  bg-red-500 "
          style={{ transform: "rotate(-138deg)" }}
        ></div>

        <div
          class="absolute  bottom-[-60vw] left-[-45vw]  w-[120vw]   h-[100vw] bg-red-500 bottom-clip-path"
          style={{ transform: "rotate(48deg)" }}
        ></div>
      </div>
    </div>
  );
};

export default page;
