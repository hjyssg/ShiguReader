import React, { useEffect, useRef, useState, useCallback } from "react";
import { getFolderThumbnail, getTagThumbnail, getZipThumbnail } from "@api/thumbnail";
import classNames from "classnames";
import "@styles/LoadingImage.scss";
const clientUtil = require("@utils/clientUtil");
const VisibilitySensor = require("react-visibility-sensor").default;

/**
 * LoadingImage (Function Component)
 *
 * Props:
 *  - url?: string                     // direct thumbnail url (if present, no request needed)
 *  - filePath?: string                // path used to request folder/zip thumbnail when url is absent
 *  - tag?: string                     // tag/author value used when mode is "tag" or "author"
 *  - mode: "tag" | "author" | "folder" | "zip"
 *  - className?: string
 *  - style?: React.CSSProperties
 *  - title?: string
 *  - musicNum?: number
 *  - ...others                        // forwarded to <img> or placeholder <div>
 */
export default function LoadingImage({
  url: propUrl,
  filePath,
  tag,
  mode,
  className,
  style,
  title,
  musicNum,
  ...others
}) {
  // state
  const [url, setUrl] = useState(propUrl);
  const [isVisible, setIsVisible] = useState(false);
  const unmountedRef = useRef(false);
  const requestedRef = useRef(false); // guard against duplicate requests

  // keep state.url in sync with prop url
  useEffect(() => {
    if (propUrl) {
      setUrl(propUrl);
    }
  }, [propUrl]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const isAuthorTagMode = mode === "author" || mode === "tag";

  const shouldAskUrl = useCallback(() => {
    if (url === "NO_THUMBNAIL_AVAILABLE" || propUrl === "NO_THUMBNAIL_AVAILABLE") return false;
    return !propUrl; // only fetch when caller didn't provide url
  }, [propUrl, url]);

  const requestThumbnail = useCallback(async () => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    try {
      let res;
      if (isAuthorTagMode) {
        // tag/author thumbnail
        const body = {};
        body[mode] = tag;
        res = await getTagThumbnail(body);
      } else if (mode === "folder") {
        res = await getFolderThumbnail(filePath);
      } else {
        // zip
        res = await getZipThumbnail(filePath);
      }

      if (!unmountedRef.current) {
        if (!res || typeof res.isFailed === "function" && res.isFailed()) {
          setUrl("NO_THUMBNAIL_AVAILABLE");
        } else {
          const nextUrl = clientUtil.getFileUrl(res.json.url);
          setUrl(nextUrl);
        }
      }
    } catch (_err) {
      if (!unmountedRef.current) {
        setUrl("NO_THUMBNAIL_AVAILABLE");
      }
    }
  }, [isAuthorTagMode, mode, tag, filePath]);

  // When visible, and we need a url, fetch it
  useEffect(() => {
    if (isVisible && shouldAskUrl()) {
      requestThumbnail();
    }
  }, [isVisible, shouldAskUrl, requestThumbnail]);

  const handleVisibilityChange = (visible) => {
    if (visible) setIsVisible(true); // only turn on
  };

  const effectiveUrl = url && url !== "NO_THUMBNAIL_AVAILABLE" ? url : undefined;

  // classes for empty placeholder with icon
  let baseCn = classNames("loading-image", className, {
    "empty-block": !effectiveUrl,
  });

  if (!effectiveUrl) {
    let fa = "";
    if (musicNum > 0) fa = "fas fa-music";
    else if (mode === "zip") fa = "fas fa-file-archive";
    else if (mode === "folder") fa = "far fa-folder";
    else if (mode === "tag") fa = "fas fa-tags";
    else if (mode === "author") fa = "fas fa-pen";
    baseCn += ` ${fa}`;
  }

  const commonTitle = title || (isAuthorTagMode ? tag : filePath);

  const content = effectiveUrl ? (
    <img
      style={style}
      className={className}
      src={effectiveUrl}
      title={commonTitle}
      loading="lazy"
      {...others}
    />
  ) : (
    <div className={baseCn} title={commonTitle} {...others} />
  );

  return (
    <VisibilitySensor
      offset={{ bottom: -200 }}
      partialVisibility={true}
      onChange={handleVisibilityChange}
    >
      {content}
    </VisibilitySensor>
  );
}
