import React, { useState, useEffect, useRef, useCallback } from "react";
import _ from "underscore";
const clientUtil = require("../clientUtil");

function BookImage(props, ref) {
  const { className, imageFiles, index, onLoad, onError, ...rest } = props;
  const preloadMade = useRef({});

  const doPreload = async () => {
    if (document.visibilityState === "visible") {
      const beg = index + 1;
      const preload_num = 2;
      const end = Math.min(beg + preload_num, imageFiles.length);

      for (let ii = beg; ii < end; ii++) {
        const url = clientUtil.getFileUrl(imageFiles[ii]);
        // 避免重复load
        if(preloadMade[url]){
            continue;
        }
        preloadMade[url] = true;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/octet-stream",
          },
        });
      }
    }
  };

  const onImageError = (error) => {
    console.error(error);
    onError && onError();
  };

    
  const imageSrc = clientUtil.getFileUrl(imageFiles[index]);
  preloadMade[imageSrc] = true;
  doPreload();

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
