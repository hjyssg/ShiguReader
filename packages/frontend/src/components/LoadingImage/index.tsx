
import React, { useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { getDetailedThumbnail, getTagThumbnail } from "@api/thumbnail";
import classNames from "classnames";
import './LoadingImage.scss';
import VisibilitySensor from "@components/common/VisibilitySensor";
import * as clientUtil from "@utils/clientUtil";

interface LoadingImageProps {
    url?: string;
    filePath?: string;
    tag?: string;
    mode: "tag" | "author" | "folder" | "zip";
    className?: string;
    style?: React.CSSProperties;
    title?: string;
    musicNum?: number;
    [key: string]: any;
}

export default function LoadingImage({
    url: propUrl,
    filePath,
    tag,
    mode,
    className,
    style,
    title,
    musicNum = 0,
    ...others
}: LoadingImageProps) {
    const [url, setUrl] = useState(propUrl);
    const [isVisible, setIsVisible] = useState(false);
    const requestedRef = useRef(false);

    useEffect(() => {
        if (propUrl) {
            setUrl(propUrl);
        }
    }, [propUrl]);

    const isAuthorTagMode = mode === "author" || mode === "tag";

    const shouldAskUrl = useCallback(() => {
        if (url === "NO_THUMBNAIL_AVAILABLE" || propUrl === "NO_THUMBNAIL_AVAILABLE") return false;
        return !propUrl;
    }, [propUrl, url]);

    const requestThumbnail = useCallback(async () => {
        if (requestedRef.current) return;
        requestedRef.current = true;

        try {
            let res: any;
            if (isAuthorTagMode) {
                const body: any = {};
                body[mode] = tag;
                res = await getTagThumbnail(body);
            } else if ((mode === "folder" || mode === "zip") && filePath) {
                res = await getDetailedThumbnail(filePath, {
                    allowVideoPreviewForFolder: false,
                });
            }

            if (!res || (res as any).isFailed()) {
                setUrl("NO_THUMBNAIL_AVAILABLE");
            } else {
                const nextUrl = (clientUtil as any).getFileUrl(res.json.url);
                setUrl(nextUrl);
            }
        } catch (_err) {
            setUrl("NO_THUMBNAIL_AVAILABLE");
        }
    }, [isAuthorTagMode, mode, tag, filePath]);

    useEffect(() => {
        if (isVisible && shouldAskUrl()) {
            requestThumbnail();
        }
    }, [isVisible, shouldAskUrl, requestThumbnail]);

    const handleVisibilityChange = (visible: boolean) => {
        if (visible) setIsVisible(true);
    };

    const effectiveUrl = url && url !== "NO_THUMBNAIL_AVAILABLE" ? url : undefined;

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
            offset={{ bottom: 200 }}
            partialVisibility={true}
            onChange={handleVisibilityChange}
        >
            {content}
        </VisibilitySensor>
    );
}
