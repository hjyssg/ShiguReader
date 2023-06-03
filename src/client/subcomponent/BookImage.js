import React, { useState, useEffect, useRef, useCallback } from "react";
import _ from "underscore";
const clientUtil = require("../clientUtil");
import {useThrottleCallback} from '@react-hook/throttle'

function BookImage(props, ref) {
  const { className, imageFiles, index, onLoad, ...rest } = props;
  const [imageSrc, setImageSrc] = useState("");
  //   const nextImgRef = useRef(null);

  useEffect(() => {
    // 组件挂载时获取图片数据
    throttledGetImageData();
  }, [index]);

  function makeTwoImageSameHeight() {
    // 这里需要自己实现makeTwoImageSameHeight函数的逻辑
  }

  async function getImageData() {
    try {
        //   console.log(props, index);
      console.log(index);
      const response = await fetch(clientUtil.getFileUrl(imageFiles[index]), {
        method: "GET",
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });

      const blob = await response.blob();

      if (blob.size > 0) {
        const reader = new FileReader();

        reader.onloadend = () => {
          const binaryString = reader.result;
          setImageSrc(`data:image/jpeg;base64,${btoa(binaryString)}`);
          onLoad && onLoad();
        };

        reader.readAsBinaryString(blob);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // 当使用 _.throttle 时，为了确保节流函数的稳定性，需要使用 useCallback 将回调函数缓存下来，并将 _.throttle 函数作为一个依赖项。
  const throttledGetImageData = useThrottleCallback(getImageData, 4);

  return (
    <img
      className={className}
      src={imageSrc}
      alt="book-image"
      ref={ref}
      // ref={nextImgRef}
      // onLoad={makeTwoImageSameHeight}
      // index={index + 1}
      // onError={throttledGetImageData}
      {...rest}
    />
  );
}

export default React.forwardRef(BookImage);
