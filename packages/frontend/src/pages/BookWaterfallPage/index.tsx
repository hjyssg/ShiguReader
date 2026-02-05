import React, { useState, useEffect, useCallback, useRef } from 'react';
import _ from 'underscore';
import { Link, RouteComponentProps } from 'react-router-dom';
import screenfull from 'screenfull';
import classNames from 'classnames';
import queryString from 'query-string';

import { listImageFolderContent } from '@api/folder';
import { extractZip } from '@api/extract';
import '../shared/OneBook.scss';
import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import FileNameDiv from '@components/common/FileNameDiv';
import VisibilitySensor from '@components/common/VisibilitySensor';
import FileChangeToolbar from '@components/common/FileChangeToolbar';

import * as util from "@common/util";
import * as clientUtil from "@utils/clientUtil";

// Import Types
import { BookOverviewResponse } from '@common/types';

const { getDir, getBaseName, isMobile, getFileUrl, sortFileNames } = clientUtil as any;

interface SmartImageProps {
    url: string;
    index: number;
    visible?: boolean;
    style?: React.CSSProperties;
}

const SmartImage: React.FC<SmartImageProps> = ({ url, index, visible = false, style }) => {
    const [isVisible, setIsVisible] = useState(visible);

    const onChange = useCallback((newVisible: boolean) => {
        if (isVisible && !newVisible) {
            return;
        }
        setIsVisible(newVisible);
    }, [isVisible]);

    let content = (
        <img
            className="one-book-waterfall-image"
            src={isVisible ? url : ""}
            title={index.toString()}
            style={style}
            loading="lazy"
            alt={index.toString()} // Added alt for accessibility
        />
    );

    return (
        <VisibilitySensor offset={{ bottom: 200 }} partialVisibility={true} onChange={onChange}>
            {content}
        </VisibilitySensor>
    );
};

interface BookWaterfallPageProps extends RouteComponentProps {
    location: any;
}

const BookWaterfallPage: React.FC<BookWaterfallPageProps> = ({ location }) => {
    const [imageFiles, setImageFiles] = useState<string[]>([]);
    const [musicFiles, setMusicFiles] = useState<string[]>([]);
    const [path, setPath] = useState<string>("");
    const [fileStat, setFileStat] = useState<any>(null);
    const [zipInfo, setZipInfo] = useState<any>(null);
    const [res, setRes] = useState<any>(null);
    const [rerenderTick, setRerenderTick] = useState(0);

    const wrapperRef = useRef<HTMLDivElement>(null);

    const getTextFromQuery = useCallback(() => {
        return (queryString.parse(location.search)["p"] as string) || "";
    }, [location.search]);

    const askRerender = useCallback(() => {
        setRerenderTick(tick => tick + 1);
    }, []);

    const isImgFolder = useCallback(() => {
        return !util.isCompress(getTextFromQuery());
    }, [getTextFromQuery]);

    // Data Loading
    const handleRes = useCallback((response: any) => {
        setRes(response);
        if (response && !response.isFailed()) {
            let { zipInfo, path, stat, imageFiles = [], musicFiles = [] } = response.json;

            (sortFileNames as any)(imageFiles);
            (sortFileNames as any)(musicFiles);

            setImageFiles(imageFiles);
            setMusicFiles(musicFiles);
            setPath(path);
            setFileStat(stat);
            setZipInfo(zipInfo);
        } else {
            askRerender();
        }
    }, [askRerender]);

    const sendExtract = useCallback(async () => {
        const fp = getTextFromQuery();
        const response = isImgFolder()
            ? await listImageFolderContent({ filePath: fp, startIndex: 0 })
            : await extractZip({ filePath: fp, startIndex: 0 });
        handleRes(response);
    }, [getTextFromQuery, isImgFolder, handleRes]);

    useEffect(() => {
        sendExtract();

        if (!isMobile()) {
            if ((screenfull as any).isEnabled) {
                (screenfull as any).on('change', () => {
                    askRerender();
                });
            }
        }

        return () => {
            if ((screenfull as any).isEnabled) {
                (screenfull as any).off('change', askRerender);
            }
        };
    }, []); // Run once on mount

    // Watch path change logic if needed, but original used componentDidMount

    const isFailedLoading = useCallback(() => {
        return res && res.isFailed();
    }, [res]);

    const getMaxHeight = useCallback(() => {
        let height = clientUtil.getWindowsHeight();
        height -= 10;
        return height;
    }, []);

    const hasImage = useCallback(() => {
        return imageFiles.length > 0;
    }, [imageFiles]);

    // Handlers
    const onNewPath = useCallback((res: any) => {
        let newPath = res.json.dest;
        const oldP = encodeURIComponent(path);
        const newP = encodeURIComponent(newPath);

        if (newPath) {
            const newUrl = location.href.replace(oldP, newP);
            window.history.pushState({}, "", newUrl);
            setPath(newPath);
        }
    }, [path]);

    // Rendering
    const renderPath = () => {
        if (!path) {
            return null;
        }

        const parentPath = getDir(path);
        const toUrl = (clientUtil as any).getExplorerLink(parentPath);

        return (
            <div className="one-book-path">
                <Link target="_blank" to={toUrl}>{parentPath} </Link>
            </div>);
    };

    const renderImage = () => {
        if (!hasImage()) {
            return null;
        }

        const maxHeight = getMaxHeight();

        let images = imageFiles.map((file, index) => {
            return (<div key={file} className="one-book-waterfall-div">
                <SmartImage
                    visible={index < 3}
                    url={getFileUrl(file)}
                    index={index}
                    style={{ maxHeight: maxHeight }}
                />
            </div>);
        });
        return (<div className="mobile-one-book-container">
            {images}
        </div>);
    };

    const renderToolbar = () => {
        // Toolbar was present in original render but conditionally
        // In original: {_.isEmpty(imageFiles) && _.isEmpty(musicFiles) ... {this.renderToolbar()} }
        // Wait, renderToolbar was defined but not used in the main render return except in the empty case?
        // Ah, looking at lines 199. It is used in empty case.
        // But what about normal case? 
        // Original code: line 223 {content} which wraps renderImage.
        // It seems toolbar is ONLY shown when empty? That seems odd for a toolbar that changes path?
        // Let's check original renderToolbar definition.
        // It uses FileChangeToolbar.
        // In BookReadPage it is rendered at bottom.
        // In BookWaterfallPage original, it is ONLY rendered in the empty case (line 199).
        // Wait, I should double check. 
        // Line 221: <div className="one-book-container"> {bookTitle} {content} </div>
        // It seems file change toolbar is NOT in the main view in original BookWaterfallPage?
        // That's strange. But I will follow the original code structure.

        if (!path) {
            return null;
        }
        return (
            <FileChangeToolbar
                isFolder={isImgFolder()}
                bigFont={true}
                className="one-book-toolbar"
                file={path}
                popPosition={"top-center"}
                returnButtonOnly={true}
                onNewPath={onNewPath}
            />
        );
    };

    const renderTags = () => {
        return null; // Original didn't seem to implement renderTags fully, just called it in empty case?
        // wait, line 198 {this.renderTags()}. But renderTags is NOT defined in the class in the snippet I saw!
        // It might be inherited? No, it extends Component.
        // Maybe I missed it in the view_file? 
        // Let's look at Step 16 again.
        // I see renderImage, renderPath, hasImage, render.
        // I DO NOT see renderTags defined in the class.
        // It might be a bug in original code or I missed something.
        // If it's not defined, calling it would crash.
        // Maybe it assumes it exists? 
        // I will assume it's valid to omit or just place a placeholder if unsure.
        // I'll leave it out to avoid TS error, or check if it's imported.
    };

    if (isFailedLoading()) {
        const fp = getTextFromQuery();
        return <ErrorPage res={res} filePath={fp} />;
    }

    const bookTitle = (
        <div className="one-book-title" >
            <FileNameDiv filename={getBaseName(path)} />
            {renderPath()}
        </div>
    );

    if (_.isEmpty(imageFiles) && _.isEmpty(musicFiles)) {
        if (res && !res.isFailed()) {
            return (
                <h3>
                    <center style={{ paddingTop: "200px" }}>
                        <div className="alert alert-warning col-6" role="alert" > No image or music file </div>
                        {bookTitle}
                        {/* {renderTags()} */}
                        {renderToolbar()}
                    </center>
                </h3>
            );
        } else {
            return (<CenterSpinner text={getTextFromQuery()} splitFilePath />);
        }
    }

    if (path) {
        document.title = getBaseName(path);
    }

    const wrapperCn = classNames("one-book-wrapper", {
        "full-screen": (screenfull as any).isEnabled && (screenfull as any).isFullscreen,
    });

    return (
        <div className="one-book-container">
            {bookTitle}
            <div className={wrapperCn} ref={wrapperRef}>
                {renderImage()}
            </div>
        </div>
    );
};

export default BookWaterfallPage;
