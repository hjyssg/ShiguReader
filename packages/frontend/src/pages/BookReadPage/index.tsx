import React, { useState, useEffect, useCallback, useRef } from 'react';
import _ from 'underscore';
import classNames from 'classnames';
import ReactDOM from 'react-dom';
import { match } from 'react-router-dom';
import { History } from 'history';

import { Link, withRouter, RouteComponentProps } from 'react-router-dom';
import { listImageFolderContent } from '@api/folder';
import { extractZip } from '@api/extract';
import { addHistoryRecord } from '@api/history';
import '../shared/OneBook.scss';
import ErrorPage from '@pages/ErrorPage';
import Spinner from '@components/common/Spinner';
import CenterSpinner from '@components/common/CenterSpinner';
import FileNameDiv from '@components/common/FileNameDiv';
import BookImage from '@components/common/BookImage';
import FileChangeToolbar from '@components/common/FileChangeToolbar';
import HistorySection from '@components/common/HistorySection';
import MusicPlayer from '@components/MusicPlayer';
import $ from 'jquery';
import './BigColumnButton.scss';
import screenfull from 'screenfull';
import { GlobalContext } from '@context/GlobalContext';

// Import Types
import { BookOverviewResponse, FileInfo } from '@common/types';

const util = require("@common/util");
const queryString = require('query-string');
const userConfig = require('@config/user-config');
const clientUtil = require("@utils/clientUtil");
const { getDir, getBaseName, isMobile, getFileUrl, sortFileNames, filesizeUitl } = clientUtil;

const MIN_HEIGHT = 400;
const MIN_WIDTH = 400;

const NO_TWO_PAGE = "no_clip";
const TWO_PAGE_LEFT = "left";
const TWO_PAGE_RIGHT = "right";

interface BookReadPageProps extends RouteComponentProps {
    location: any;
}

const BookReadPage: React.FC<BookReadPageProps> = ({ location }) => {
    const [imageFiles, setImageFiles] = useState<string[]>([]);
    const [musicFiles, setMusicFiles] = useState<string[]>([]);
    const [videoFiles, setVideoFiles] = useState<string[]>([]);
    const [dirs, setDirs] = useState<string[]>([]);

    // Helper to get initial index
    const getInitIndex = () => {
        const parsed = queryString.parse(location.hash);
        return parseInt(parsed.index as string) || 0;
    };

    const [index, setIndexState] = useState<number>(getInitIndex());
    const [twoPageMode, setTwoPageMode] = useState<string>(NO_TWO_PAGE);
    const [path, setPath] = useState<string>("");
    const [fileStat, setFileStat] = useState<any>(null);
    const [zipInfo, setZipInfo] = useState<any>(null);
    const [mecab_tokens, setMecabTokens] = useState<any>(null);
    const [outputPath, setOutputPath] = useState<string>("");
    const [rerenderTick, setRerenderTick] = useState<number>(0);
    const [res, setRes] = useState<any>(null);

    // Refs for mutable non-state variables
    const zoomScaleRef = useRef<number | null>(null);
    const bookHistoryRecordedRef = useRef<boolean>(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<any>(null); // BookImage component ref might be different than HTMLImageElement
    const nextImgRef = useRef<any>(null);
    const imgContainerRef = useRef<HTMLDivElement>(null);

    // Mouse interaction refs
    const clickedRef = useRef<boolean>(false);
    const clickYRef = useRef<number>(0);
    const clickXRef = useRef<number>(0);
    const rotateAngleRef = useRef<number>(0);
    const loadedImageRef = useRef<number | null>(null);
    const spinnerTimerRef = useRef<NodeJS.Timeout | null>(null);

    const setIndex = useCallback((newIndex: number) => {
        clientUtil.replaceUrlHash(queryString.stringify({ index: newIndex }));
    }, []);

    const getTextFromQuery = useCallback(() => {
        return (queryString.parse(location.search)["p"] as string) || "";
    }, [location.search]);

    const askRerender = useCallback(() => {
        setRerenderTick(tick => tick + 1);
    }, []);

    const isImgFolder = useCallback(() => {
        return !util.isCompress(getTextFromQuery());
    }, [getTextFromQuery]);

    // Handle Resize and Image Adjustment logic
    const hasMusic = useCallback(() => {
        return musicFiles.length > 0;
    }, [musicFiles]);

    const hasImage = useCallback(() => {
        return imageFiles.length > 0;
    }, [imageFiles]);

    const hasVideo = useCallback(() => {
        return videoFiles.length > 0;
    }, [videoFiles]);

    const getMaxHeight = useCallback(() => {
        let height = clientUtil.getWindowsHeight();
        if (hasMusic()) {
            height = Math.max(450, height / 2);
        } else {
            height -= 10;
        }
        return height;
    }, [hasMusic]);

    const getMaxWidth = useCallback(() => {
        let width = clientUtil.getWindowsWidth();
        if (!isMobile()) {
            width -= 50;
        }
        return width;
    }, []);

    const getImageLength = useCallback(() => {
        return imageFiles.length;
    }, [imageFiles]);

    const getLastIndex = useCallback(() => {
        return (imageFiles || []).length - 1;
    }, [imageFiles]);

    const shouldTwoPageMode = useCallback(() => {
        return index < getLastIndex() && (twoPageMode === TWO_PAGE_LEFT || twoPageMode === TWO_PAGE_RIGHT);
    }, [index, getLastIndex, twoPageMode]);

    const makeTwoImageSameHeight = useCallback(() => {
        if (shouldTwoPageMode()) {
            // Using direct DOM manipulation as in original code
            // ideally this should be managed via state/props but keeping logic close to original for now
            const imageDom = ReactDOM.findDOMNode(nextImgRef.current) as HTMLElement;
            const currentImgDom = ReactDOM.findDOMNode(imgRef.current) as HTMLElement;
            if (imageDom && currentImgDom) {
                imageDom.setAttribute("height", currentImgDom.getAttribute("height") || "");
            }
        }
    }, [shouldTwoPageMode]);

    const applyHWToImage = useCallback((height: number, width: number) => {
        let imageDom = ReactDOM.findDOMNode(imgRef.current) as HTMLElement;
        if (!imageDom) {
            return;
        }

        // We set attributes directly
        imageDom.setAttribute("height", height.toString());
        imageDom.setAttribute("width", width.toString());

        makeTwoImageSameHeight();
    }, [makeTwoImageSameHeight]);

    const applyHWSetToImage = useCallback((set: number[]) => {
        applyHWToImage(set[0], set[1]);
    }, [applyHWToImage]);

    const pickBestHw = useCallback((imgTrueHeight: number, imgTrueWidth: number) => {
        const maxHeight = getMaxHeight();
        const maxWidth = getMaxWidth();

        //make sure both width and height 
        let newHeight = Math.min(imgTrueHeight, maxHeight);
        newHeight = Math.max(newHeight, MIN_HEIGHT);
        const calculatedWidth = newHeight / imgTrueHeight * imgTrueWidth;
        const set1 = [newHeight, calculatedWidth];

        let newWidth = Math.min(imgTrueWidth, maxWidth);
        newWidth = Math.max(newWidth, MIN_WIDTH);
        const calculatedHeight = newWidth / imgTrueWidth * imgTrueHeight;
        const set2 = [calculatedHeight, newWidth];

        //I would rather small than bigger
        //max dimension is more important than min dimension
        if (set1[0] <= maxHeight && set1[1] <= maxWidth) {
            applyHWSetToImage(set1);
        } else if (set2[0] <= maxHeight && set2[1] <= maxWidth) {
            applyHWSetToImage(set2);
        } else if (set1[0] <= maxHeight) {
            applyHWSetToImage(set1);
        } else {
            applyHWSetToImage(set2);
        }
    }, [getMaxHeight, getMaxWidth, applyHWSetToImage]);

    // Main Image Adjustment Function
    const adjustImageSize = useCallback(() => {
        if (isMobile()) {
            return;
        }

        loadedImageRef.current = index;
        const imageDom = ReactDOM.findDOMNode(imgRef.current) as HTMLImageElement;
        if (!imageDom) {
            return;
        }

        const imgDomHeight = imageDom.clientHeight;
        const imgDomWidth = imageDom.clientWidth;
        const imgTrueHeight = imageDom.naturalHeight;
        const imgTrueWidth = imageDom.naturalWidth;

        if (zoomScaleRef.current && userConfig.keep_zoom_scale) {
            applyHWToImage((imgTrueHeight * zoomScaleRef.current), (imgTrueWidth * zoomScaleRef.current));
            return;
        }

        //display img's real px number
        const dimDom = document.getElementsByClassName("dimension-tag")[0];
        if (dimDom) {
            dimDom.textContent = `${imageDom.naturalWidth}×${imageDom.naturalHeight}`;
        }

        clickedRef.current = false;
        clickYRef.current = 0;
        clickXRef.current = 0;

        //set max height
        const maxHeight = getMaxHeight();
        const maxWidth = getMaxWidth();

        const widthRatio = imgDomWidth / maxWidth;
        const heighthRatio = imgDomHeight / maxHeight;

        const naturalhwRatio = imgTrueHeight / imgTrueWidth;
        const domHwRatio = imgDomHeight / imgDomWidth;

        if (Math.abs(naturalhwRatio - domHwRatio) > 0.05) {
            //float error, so do not use === here
            //the ratio cannot display the full image
            pickBestHw(imgTrueHeight, imgTrueWidth);
        } else if (widthRatio > 1) {
            //too wide
            pickBestHw(imgTrueHeight, imgTrueWidth);
        } else if (heighthRatio > 1) {
            //too high
            pickBestHw(imgTrueHeight, imgTrueWidth);
        } else if (imgDomHeight < MIN_HEIGHT) {
            //too short
            pickBestHw(imgTrueHeight, imgTrueWidth);
        } else if (imgDomWidth < MIN_WIDTH) {
            //too narrow
            pickBestHw(imgTrueHeight, imgTrueWidth);
        }
    }, [index, getMaxHeight, getMaxWidth, applyHWToImage, pickBestHw]);

    // Data Loading
    const handleRes = useCallback((response: any) => {
        setRes(response);
        if (response && !response.isFailed()) {
            let { zipInfo, path, stat, imageFiles = [], musicFiles = [], videoFiles = [], dirs = [], mecab_tokens, outputPath } = response.json;

            // Fix sorting
            (sortFileNames as any)(imageFiles);
            (sortFileNames as any)(musicFiles);
            (sortFileNames as any)(videoFiles);

            setImageFiles(imageFiles);
            setMusicFiles(musicFiles);
            setVideoFiles(videoFiles);
            setDirs(dirs);
            setPath(path);
            setFileStat(stat);
            setZipInfo(zipInfo);
            setMecabTokens(mecab_tokens);
            setOutputPath(outputPath);
        } else {
            askRerender();
        }
    }, [askRerender]);

    const sendRequest = useCallback(async () => {
        const fp = getTextFromQuery();
        const params = { filePath: fp, startIndex: index || 0 };
        const response = isImgFolder()
            ? await listImageFolderContent(params)
            : await extractZip(params);
        handleRes(response);
    }, [getTextFromQuery, index, isImgFolder, handleRes]);


    // Effects
    useEffect(() => {
        sendRequest();

        if (!isMobile()) {
            if ((screenfull as any).isEnabled) {
                (screenfull as any).on('change', () => {
                    askRerender();
                });
            }
        }

        const _adjustImageSize = () => adjustImageSize();
        window.addEventListener("resize", _adjustImageSize);

        return () => {
            window.removeEventListener("resize", _adjustImageSize);
            if ((screenfull as any).isEnabled) {
                (screenfull as any).off('change', askRerender);
            }
        };
    }, []);

    // Watch path change
    useEffect(() => {
        // Equivalent to componentDidUpdate path check
    }, [path]);

    const maybeRecordBookHistory = useCallback(() => {
        if (bookHistoryRecordedRef.current) {
            return;
        }

        const parsedPageNum = zipInfo && parseInt(zipInfo.pageNum, 10);
        const totalPages = parsedPageNum > 0 ? parsedPageNum : imageFiles.length;

        if (!path || totalPages === 0) {
            return;
        }

        const currentPage = index + 1;
        const reachedProgressThreshold = currentPage / totalPages >= (1 / 3);
        const reachedPageThreshold = currentPage > 3;

        if (!reachedProgressThreshold && !reachedPageThreshold) {
            return;
        }

        bookHistoryRecordedRef.current = true;
        addHistoryRecord(path).catch((e: any) => {
            console.error(e);
            bookHistoryRecordedRef.current = false;
        });
    }, [bookHistoryRecordedRef, zipInfo, imageFiles, index, path]);

    // Handle History Recording
    useEffect(() => {
        if (path) {
            maybeRecordBookHistory();
        }
    }, [index, imageFiles, path, maybeRecordBookHistory]);

    // Reset history recorded flag on path change
    useEffect(() => {
        bookHistoryRecordedRef.current = false;
    }, [path]);


    // Event Handling
    const updateScrollPos = useCallback((e: any) => {
        // $('html').css('cursor', 'row-resize');
        const ADJUSTER = 1.05;
        let change = $(window).scrollTop()! + (clickYRef.current - e.pageY) * ADJUSTER;
        $(window).scrollTop(change);

        change = $(window).scrollLeft()! + (clickXRef.current - e.pageX) * ADJUSTER;
        $(window).scrollLeft(change);
    }, []);

    const onwheel = useCallback((e: any) => {
        const CHANGE_RATE = 1.05;
        const delta = -e.deltaY || e.wheelDelta;
        const imageDom = ReactDOM.findDOMNode(imgRef.current) as HTMLImageElement;
        if (!imageDom) return;

        const imgDomHeight = imageDom.clientHeight; // use current height
        const imgTrueHeight = imageDom.naturalHeight;
        const imgTrueWidth = imageDom.naturalWidth;

        const newHeight = delta > 0 ? imgDomHeight * CHANGE_RATE : imgDomHeight / CHANGE_RATE;
        const newWidth = newHeight / imgTrueHeight * imgTrueWidth;

        zoomScaleRef.current = newHeight / imgTrueHeight;

        applyHWToImage(newHeight, newWidth);
        e.preventDefault && e.preventDefault();
    }, [applyHWToImage]);

    // Bind User Interactions (Mouse/Wheel)
    useEffect(() => {
        if (isMobile()) {
            return;
        }

        const imageDom = wrapperRef.current;
        if (!imageDom) {
            return;
        }

        // Wheel
        const wheelHandler = (e: any) => onwheel(e);
        imageDom.addEventListener("wheel", wheelHandler, { passive: false });

        // Mouse Move/Down/Up
        // Using jQuery for consistency with original if needed, or vanilla
        const $imageDom = $(imageDom);

        const mouseMove = (e: any) => {
            if (clickedRef.current) {
                updateScrollPos(e);
            }
            e.preventDefault();
        };

        const mouseDown = (e: any) => {
            clickedRef.current = true;
            clickYRef.current = e.pageY;
            clickXRef.current = e.pageX;
            e.preventDefault();
        };

        const mouseUp = (e: any) => {
            clickedRef.current = false;
            e.preventDefault();
        }

        $imageDom.on('mousemove', mouseMove);
        $imageDom.on('mousedown', mouseDown);
        $imageDom.on('mouseup', mouseUp);

        return () => {
            imageDom.removeEventListener("wheel", wheelHandler);
            $imageDom.off('mousemove', mouseMove);
            $imageDom.off('mousedown', mouseDown);
            $imageDom.off('mouseup', mouseUp);
        };
    }, [isMobile, onwheel, updateScrollPos, imageFiles]); // Re-bind if DOM changes, essentially when imageFiles loads or similar

    // Key Down Handler
    const hideSpinner = useCallback(() => {
        if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
        document.querySelector(".one-book-img-load-spinner")?.classList.remove("show");
    }, []);

    const showSpinner = useCallback(() => {
        if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
        spinnerTimerRef.current = setTimeout(() => {
            document.querySelector(".one-book-img-load-spinner")?.classList.add("show");
        }, 500);
    }, []);

    const rotateImg = useCallback((newAngle: number) => {
        let imageDom = ReactDOM.findDOMNode(imgRef.current) as HTMLElement;
        if (imageDom) {
            if (_.isNumber(newAngle)) {
                rotateAngleRef.current = newAngle;
            } else {
                rotateAngleRef.current = (rotateAngleRef.current || 0) + 90;
            }

            rotateAngleRef.current = rotateAngleRef.current % 360;

            imageDom.setAttribute("style", "transform: rotate(" + rotateAngleRef.current + "deg)");
        }
    }, []);

    const changePage = useCallback((newIndex: number, event?: any) => {
        event && event.preventDefault();
        event && event.stopPropagation();

        if (!userConfig.keep_clip) {
            setTwoPageMode(NO_TWO_PAGE);
        }
        showSpinner();
        setIndexState(newIndex);
        setIndex(newIndex);
        rotateImg(0);

        $(window).scrollTop(0);
    }, [setIndex, rotateImg, showSpinner]);

    const next = useCallback((event?: any) => {
        if (getImageLength() <= 1) {
            return;
        }

        const jump = userConfig.keep_clip && shouldTwoPageMode() ? 2 : 1;
        let newIndex = index + jump;
        if (newIndex > getLastIndex()) {
            newIndex = 0;
        }
        changePage(newIndex, event);
    }, [getImageLength, userConfig.keep_clip, shouldTwoPageMode, index, getLastIndex, changePage]);

    const prev = useCallback((event?: any) => {
        if (getImageLength() <= 1) {
            return;
        }
        const jump = userConfig.keep_clip && shouldTwoPageMode() ? 2 : 1;
        let newIndex = index - jump;
        if (newIndex < 0) {
            newIndex = getLastIndex();
        }
        changePage(newIndex, event);
    }, [getImageLength, userConfig.keep_clip, shouldTwoPageMode, index, getLastIndex, changePage]);

    const onClickPagination = useCallback((event?: any) => {
        let input = prompt("Which page would you like to go to?");
        let newIndex = parseInt(input || "");
        if (_.isNumber(newIndex) && !isNaN(newIndex)) {
            newIndex = newIndex - 1;
            if (newIndex > getLastIndex()) {
                newIndex = getLastIndex();
            }
            changePage(newIndex, event);
        }
    }, [getLastIndex, changePage]);

    const handleKeyDown = useCallback((event: any) => {
        const key = event.key.toLowerCase();
        const isRightAsNext = clientUtil.isRightAsNext();
        if (key === "arrowright" || key === "d" || key === "l") {
            if (isRightAsNext) {
                next();
            } else {
                prev();
            }
            event.preventDefault();
        } else if (key === "arrowleft" || key === "a" || key === "j") {
            if (isRightAsNext) {
                prev();
            } else {
                next();
            }
            event.preventDefault();
        } else if (key === "+" || key === "=") {
            onwheel({ wheelDelta: 1 });
        } else if (key === "-") {
            onwheel({ wheelDelta: -1 });
        } else if (key === "g") {
            onClickPagination();
        } else if (key === "x") {
            clientUtil.triggerClickOnClass("move-to-no-good-button");
        } else if (key === "v") {
            clientUtil.triggerClickOnClass("move-to-good-button");
        } else if (key === "arrowup" || key === "w") {
            clientUtil.scrollPageByDistance(-50);
        } else if (key === "arrowdown" || key === "s") {
            clientUtil.scrollPageByDistance(50);
        }
    }, [next, prev, onwheel, onClickPagination, onwheel]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        }
    }, [handleKeyDown]);

    // Handlers
    const onImageError = useCallback(() => {
        hideSpinner();
    }, [hideSpinner]);

    const onImgLoad = useCallback(() => {
        hideSpinner();
        adjustImageSize();
    }, [hideSpinner, adjustImageSize]);

    const onClickMobileOneImageContainer = useCallback((event: any) => {
        var x = event.pageX;
        var y = event.pageY;

        // console.log(y);
        const dom = ReactDOM.findDOMNode(imgContainerRef.current) as HTMLElement;
        if (!dom) return;

        const width = dom.clientWidth;
        // const height = dom.clientHeight;

        const upperRange = 300;  //use the fixed upper range is more comportable

        const posX = x > width / 2;
        // const posY = y > upperRange;

        const isRightAsNext = clientUtil.isRightAsNext();
        if (isRightAsNext) {
            if (posX) {
                next();
            } else {
                prev();
            }
        } else {
            if (posX) {
                prev();
            } else {
                next();
            }
        }

        event.preventDefault();
    }, [next, prev]);

    const onNewPath = useCallback((res: any) => {
        let newPath = res.json.dest;
        // const { path } = this.state;

        const oldP = encodeURIComponent(path);
        const newP = encodeURIComponent(newPath);

        //change url 
        if (newPath) {
            const newUrl = location.href.replace(oldP, newP);
            window.history.pushState({}, "", newUrl);
            setPath(newPath);
        }
    }, [path]);

    // Rendering Helpers
    const renderPagination = () => {
        if (isMobile()) { return; }
        const isLast = index + 1 === getImageLength();
        const text = (index + 1) + "/" + getImageLength();
        const cn = classNames("one-book-foot-index-number", {
            "is-last": isLast
        })
        return (<div className={cn}>{text}</div>);
    };

    const getPageAvgSize = () => {
        if (!hasImage()) {
            return 0;
        }

        const pageNum = zipInfo?.pageNum || (getImageLength() + videoFiles.length);
        const totalImgSize = zipInfo?.totalImgSize || 0;
        const videoNum = zipInfo?.videoNum || videoFiles.length;

        const avgFileSize = util.calcAvgImgSize({ pageNum, totalImgSize, videoNum });

        return avgFileSize;
    };

    const renderFileSizeAndTime = () => {
        const fileSize = (fileStat?.size) || null;
        const fileDate = (fileStat?.mtimeMs) || null;

        let avgFileSize = getPageAvgSize();

        const rows: any[] = [];
        if (fileDate) {
            const mTime = clientUtil.dateFormat_ymd(new Date(fileDate));
            rows.push(["Modify Time", mTime]);
        }
        if (fileSize && fileSize > 0) {
            const size = filesizeUitl(fileSize);
            rows.push(["Total Size", size]);
        }
        if (hasImage()) {
            const title = getBaseName(imageFiles[index]);
            rows.push(["Image Name", title]);

            if (avgFileSize > 0) {
                const avg = filesizeUitl(avgFileSize);
                rows.push(["Average Image Size", avg]);
            }

            rows.push(["Dimensions"]);
        }

        if (rows.length === 0) {
            return null;
        }

        const texts = rows.map((row, ii) => {
            let title = row[0];
            let text = row[1];

            if (title === "Image Name") {
                title = `${title}: ${text}`;
                text = util.truncateString(text, 30);
            }

            return (
                <div className={title === "Dimensions" ? "dimension-tag" : ""}
                    key={ii} style={{ marginLeft: "15px" }} title={title}> {text}
                </div>);
        });

        const mobilePageNum = (<div className="mobile-page-num"
            onClick={onClickPagination} >
            {`${index + 1}/${getImageLength()}`}  </div>);

        const videoNum = hasVideo() && (<div className="video-num"> {` Video: ${videoFiles.length}`}  </div>);
        return (<div className={"one-book-file-stat"}>{texts} {mobilePageNum} {videoNum} </div>);
    };

    const renderImage = () => {
        if (!hasImage()) {
            if (hasMusic()) {
                return (<i className="fas fa-headphones-alt placeholder-for-music"></i>)
            } else {
                return null;
            }
        }

        if (!isMobile()) {
            const cn = classNames("one-book-image", {
                "has-music": hasMusic()
            });

            let nextImg = null
            if (shouldTwoPageMode()) {
                nextImg = (
                    <BookImage className={cn}
                        alt="book-image"
                        ref={nextImgRef}
                        imageFiles={imageFiles}
                        index={index + 1}
                        onLoad={makeTwoImageSameHeight}
                    />);
            };

            return (<>
                <Spinner className="one-book-img-load-spinner" />
                {twoPageMode === TWO_PAGE_RIGHT && nextImg}
                <BookImage
                    className={cn}
                    alt="book-image"
                    ref={imgRef}
                    imageFiles={imageFiles}
                    index={index}
                    onError={onImageError}
                    onLoad={onImgLoad}
                    loading="lazy"
                />
                {twoPageMode === TWO_PAGE_LEFT && nextImg}
            </>);
        } else {
            let images;
            const cn = classNames("mobile-single-image", {
                "has-music": hasMusic()
            });
            images = (
                <div className="mobile-single-image-container"
                    ref={imgContainerRef}
                    onClick={onClickMobileOneImageContainer}>
                    <BookImage
                        className={cn}
                        ref={imgRef}
                        imageFiles={imageFiles}
                        index={index}
                        onError={onImageError}
                        onLoad={onImgLoad}
                        loading="lazy"
                    />
                </div>);
            return (<div className="mobile-one-book-container">
                <Spinner className="one-book-img-load-spinner" />
                {images}
            </div>);
        }
    };

    const renderLinkRow = () => {
        if (!path) {
            return;
        }

        const exploreCN = (dirs.length > 0) || hasVideo() ? "orange-font" : ""; // hasFolder check

        if (!hasImage()) {
            const toUrl3 = clientUtil.getExplorerLink(outputPath || path);
            return (
                <div className="one-book-overview-path">
                    <Link className={exploreCN} to={toUrl3}> Explorer </Link>
                </div>);
        } else {
            const toUrl = clientUtil.getBookOverviewLink(path);
            const toUrl2 = clientUtil.getBookWaterfallLink(path);
            const toUrl3 = clientUtil.getExplorerLink(outputPath || path);

            return (
                <div className="one-book-overview-path">
                    <Link target="_blank" to={toUrl}> Overview </Link>
                    <Link target="_blank" to={toUrl2}> Waterfall </Link>
                    <Link target="_blank" className={exploreCN} to={toUrl3}> Explorer </Link>
                </div>);
        }
    };

    const renderPath = () => {
        if (!path) {
            return;
        }
        const parentPath = getDir(path);
        const toUrl = clientUtil.getExplorerLink(parentPath);

        return (
            <div className="one-book-path">
                <Link target="_blank" to={toUrl}>{parentPath} </Link>
            </div>);
    };

    const renderToolbar = () => {
        if (!path) {
            return;
        }
        const toolbar = <FileChangeToolbar
            isFolder={isImgFolder()}
            bigFont={true}
            className="one-book-toolbar"
            file={path}
            popPosition={"top-center"}
            returnButtonOnly={true}
            onNewPath={onNewPath} />;
        return toolbar;
    };

    // Main Render
    const isFailedLoading = () => {
        return res && res.isFailed();
    };

    if (isFailedLoading()) {
        const fp = getTextFromQuery();
        return <ErrorPage res={res} filePath={fp} />;
    }

    if (_.isEmpty(imageFiles) && _.isEmpty(musicFiles)) {
        if (res && !res.isFailed()) {
            const bookTitle = (
                <div className="one-book-title">
                    <FileNameDiv filename={getBaseName(path)} />
                    {renderPath()}
                </div>
            );
            return (
                <h3>
                    <center style={{ paddingTop: "200px" }}>
                        <div className="alert alert-warning col-6" role="alert">
                            {" "}
                            No image or music file{" "}
                        </div>
                        {bookTitle}
                    </center>
                </h3>
            );
        } else {
            return <CenterSpinner text={getTextFromQuery()} splitFilePath />;
        }
    }

    if (path) {
        document.title = getBaseName(path);
    }

    const wrapperCn = classNames("one-book-wrapper", {
        "full-screen": (screenfull as any).isEnabled && (screenfull as any).isFullscreen,
        "has-music": hasMusic()
    });

    const content = (
        <div className={wrapperCn} ref={wrapperRef}>
            {renderImage()}
            {hasMusic() && (
                <MusicPlayer
                    audioFiles={musicFiles}
                    path={path}
                    className="one-book-music-player"
                />
            )}
        </div>
    );

    return (
        <div className="one-book-container">
            {content}
            {renderPagination()}
            {renderFileSizeAndTime()}
            {renderLinkRow()}
            {renderToolbar()}
        </div>
    );
};

export default withRouter(BookReadPage);
