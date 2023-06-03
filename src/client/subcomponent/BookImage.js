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

  const doPreload =  async () => {
    if(document.visibilityState === 'visible'){
      const beg = index + 1;
      const preload_num = 2;
      const end = Math.min(beg + preload_num, imageFiles.length);
  
      for(let ii = beg; ii < end; ii++){
        // const temp =  <link rel="preload" key={ii} href={getFileUrl(imageFiles[ii])} as="image" />
        // result.push(temp);
        const url = clientUtil.getFileUrl(imageFiles[ii]);
        const response = await fetch(url, {
            method: "GET",
            headers: {
              "Content-Type": "application/octet-stream",
            },
          });
      }
    }
  }

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

      // preload
      doPreload();

    } catch (error) {
      console.error(error);
      console.error(error);
      setImageSrc("/error_loading.png");
    }
  }

  
  const onImageError = (error) => {
    // https://stackoverflow.com/questions/5559578/having-links-relative-to-root
    if(imageSrc){
        console.error(error);
        setImageSrc("/error_loading.png");
        onError && onError()
    }
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
