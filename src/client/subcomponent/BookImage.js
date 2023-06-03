import React, { useState, useEffect, useRef, useCallback } from "react";
import _ from "underscore";
const clientUtil = require("../clientUtil");
import {useThrottleCallback} from '@react-hook/throttle'

function BookImage(props, ref) {
  const { className, imageFiles, index, onLoad, ...rest } = props;
  const [imageSrc, setImageSrc] = useState("");

  useEffect(() => {
    // 组件挂载时获取图片数据
    throttledGetImageData();
  }, [index]);

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

  const throttledGetImageData = useThrottleCallback(getImageData, 4);

  return (
    <img
      className={className}
      src={imageSrc}
      alt="book-image"
      ref={ref}
      {...rest}
    />
  );
}

export default React.forwardRef(BookImage);
