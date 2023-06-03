import React, { useState, useEffect, useRef, useCallback } from "react";
import _ from "underscore";
const clientUtil = require("../clientUtil");
import { useThrottleCallback } from "@react-hook/throttle";

function BookImage(props, ref) {
  const { className, imageFiles, index, onLoad, onError, ...rest } = props;
  const [imageSrc, setImageSrc] = useState("");

  useEffect(() => {
    // 组件挂载时获取图片数据
    throttledGetImageData();
  }, [index]);

  async function getImageData() {
    try {
      //   console.log(props, index);
      console.log(index);
      const url = clientUtil.getFileUrl(imageFiles[index]);
      if (!url) {
        return;
      }

      const response = await fetch(url, {
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
          setImageSrc(`data:image/jpeg;base64,${window.btoa(binaryString)}`);
        };
        reader.readAsBinaryString(blob);
      }

    } catch (error) {
      console.error(error);
      console.error(error);
      setImageSrc("/error_loading.png");
    }
  }

  
  const onImageError = (error) => {
    // https://stackoverflow.com/questions/5559578/having-links-relative-to-root
    // this.imgRef.src = "/error_loading.png";
    console.error(error);
    setImageSrc("/error_loading.png");
    onError && onError()
  }

  const throttledGetImageData = useThrottleCallback(getImageData, 4);

  return (
    <img
      className={className}
      src={imageSrc}
      alt="book-image"
      onError={onImageError}
      onLoad={onLoad}
      ref={ref}
      {...rest}
    />
  );
}

export default React.forwardRef(BookImage);
