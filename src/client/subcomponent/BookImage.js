import React, { useState, useEffect, useRef } from "react";
import _ from "underscore";
const clientUtil = require("../clientUtil");
const util = require("@common/util");


function BookImage(props, ref) {
  const { className, imageFiles, index, onLoad, onError, ...rest } = props;
  const preloadMade = useRef({});
  const [imageSrc, setImageSrc] = useState(clientUtil.getFileUrl(imageFiles[index]));

  const preloadImages = async (startIndex) => {
    const beg = startIndex + 1;
    const preload_num = 2;
    const end = Math.min(beg + preload_num, imageFiles.length);

    for (let ii = beg; ii < end; ii++) {
      const url = clientUtil.getFileUrl(imageFiles[ii]);
      if (preloadMade.current[url]) {
        continue;
      }
      preloadMade.current[url] = true;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/octet-stream" },
      });

      await util.pause(300);
    }
  };

  // 使用 Underscore 的 _.debounce 函数来防抖
  useEffect(() => {
    const debounceSetImageSrc = _.debounce(() => {
      setImageSrc(clientUtil.getFileUrl(imageFiles[index]));
      preloadImages(index);
    }, 10);

    debounceSetImageSrc();

    return () => debounceSetImageSrc.cancel(); // 清理函数，取消未执行的防抖函数
  }, [index]);

  const onImageError = (error) => {
    console.error(error);
    onError && onError();
  };

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
