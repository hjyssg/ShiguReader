import React, { useState, useEffect, useRef, useCallback } from "react";
import _ from "underscore";
const clientUtil = require("../clientUtil");
import { useThrottleCallback } from "@react-hook/throttle";

function BookImage(props, ref) {
  const { className, imageFiles, index, onLoad, onError, ...rest } = props;
  const [imageSrc, setImageSrc] = useState("");
  const [prealoadMade, setprealoadMade] = useState({});

  //   react hook在闭包拿到最新的props
  const latestProps = useRef(props);
  useEffect(() => {
    // 当useEffect hook被调用时，它会在每次组件渲染后都执行一次。如果您没有传递第二个参数（依赖项数组），则useEffect hook将在每次组件渲染后都执行一次，并且没有任何限制。
    latestProps.current = props;
  });

  useEffect(() => {
    // 组件挂载时获取图片数据
    throttledGetImageData();
  }, [index]);

  const doPreload = async () => {
    if (document.visibilityState === "visible") {
      const beg = index + 1;
      const preload_num = 2;
      const end = Math.min(beg + preload_num, imageFiles.length);

      for (let ii = beg; ii < end; ii++) {
        const url = clientUtil.getFileUrl(imageFiles[ii]);
        // 避免重复load
        if(prealoadMade[url]){
            continue;
        }
        prealoadMade[url] = true;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/octet-stream",
          },
        });
      }
    }
  };

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
      prealoadMade[url] = true;

      const blob = await response.blob();
      if (blob.size > 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const binaryString = reader.result;

          // 闭包的坑
          if (latestProps.current.index == index) {
            setImageSrc(`data:image/jpeg;base64,${window.btoa(binaryString)}`);
          } else {
            console.log(latestProps.current.index, index);
          }

          onLoad && onLoad();
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
    if (imageSrc) {
      console.error(error);
      setImageSrc("/error_loading.png");
      onError && onError();
    }
  };

  const throttledGetImageData = useThrottleCallback(getImageData, 10);

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
