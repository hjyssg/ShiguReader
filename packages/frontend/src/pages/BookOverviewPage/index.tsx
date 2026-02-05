
import React, { useState, useEffect, useCallback } from 'react';
import _ from 'underscore';
import { Link, withRouter, RouteComponentProps } from 'react-router-dom';
import queryString from 'query-string';

import { listImageFolderContent } from '@api/folder';
import { extractZip } from '@api/extract';
import '../shared/OneBook.scss';
import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import FileNameDiv from '@components/common/FileNameDiv';
import VisibilitySensor from '@components/common/VisibilitySensor';

import * as util from "@common/util";
import * as clientUtil from "@utils/clientUtil";
import { BookOverviewResponse } from '@common/types';

const { getDir, getBaseName, getFileUrl, sortFileNames } = clientUtil as any;

interface SmartImageProps {
    url: string;
    index: number;
    filePath: string;
    dirPath: string;
}

const SmartImage: React.FC<SmartImageProps> = ({ url, index, filePath, dirPath }) => {
    const [isVisible, setIsVisible] = useState(false);

    const onChange = useCallback((visible: boolean) => {
        if (isVisible && !visible) {
            return;
        }
        setIsVisible(visible);
    }, [isVisible]);

    let content;
    if (isVisible) {
        const tooltip = `page: ${index} \nfilename: ${getBaseName(filePath)}`;
        content = (
            <img
                className="single-img-cell"
                src={url}
                title={tooltip}
                loading="lazy"
                alt={getBaseName(filePath)}
            />
        );
    } else {
        content = <div className="place-holder single-img-cell" title={index.toString()} />;
    }

    const toUrl = (clientUtil as any).getBookReadLink(dirPath, index);

    return (
        <VisibilitySensor offset={{ bottom: 200 }} partialVisibility={true} onChange={onChange}>
            <div className="col-lg-3 col-md-4 col-6 a-with-padding" key={url}>
                <Link to={toUrl} target="_blank" className="obov-link">
                    {content}
                </Link>
            </div>
        </VisibilitySensor>
    );
};

interface BookOverviewPageProps extends RouteComponentProps {
    location: any;
}

const BookOverviewPage: React.FC<BookOverviewPageProps> = ({ location }) => {
    const [imageFiles, setImageFiles] = useState<string[]>([]);
    const [musicFiles, setMusicFiles] = useState<string[]>([]);
    const [path, setPath] = useState<string>("");
    const [fileStat, setFileStat] = useState<any>(null);
    const [zipInfo, setZipInfo] = useState<any>(null);
    const [res, setRes] = useState<any>(null);
    const [rerenderTick, setRerenderTick] = useState(0);

    const getTextFromQuery = useCallback(() => {
        return (queryString.parse(location.search)["p"] as string) || "";
    }, [location.search]);

    const isImgFolder = useCallback(() => {
        return !util.isCompress(getTextFromQuery());
    }, [getTextFromQuery]);

    const handleRes = useCallback((response: any) => {
        setRes(response);
        if (response && !response.isFailed()) {
            let { zipInfo, path, stat, imageFiles, musicFiles } = response.json as BookOverviewResponse;
            imageFiles = imageFiles || [];
            musicFiles = musicFiles || [];

            (sortFileNames as any)(imageFiles);
            (sortFileNames as any)(musicFiles);

            setImageFiles(imageFiles);
            setMusicFiles(musicFiles);
            setPath(path || "");
            setFileStat(stat);
            setZipInfo(zipInfo);
        } else {
            askRerender();
        }
    }, []);

    const sendExtract = useCallback(async () => {
        const fp = getTextFromQuery();
        if (!fp) return;

        const response = isImgFolder()
            ? await listImageFolderContent({ filePath: fp, startIndex: 0 })
            : await extractZip({ filePath: fp, startIndex: 0 });
        handleRes(response);
    }, [getTextFromQuery, isImgFolder, handleRes]);

    useEffect(() => {
        sendExtract();
    }, [sendExtract, rerenderTick]);

    const askRerender = () => {
        setRerenderTick(prev => prev + 1);
    };

    const isFailedLoading = () => {
        return res && (res as any).isFailed();
    };

    const hasImage = () => {
        return imageFiles.length > 0;
    };

    const renderImageGrid = () => {
        if (!hasImage()) {
            return null;
        }

        const fp = getTextFromQuery();
        return imageFiles.map((e, ii) => {
            let url = getFileUrl(e, true);
            return (
                <SmartImage
                    key={e + ii}
                    url={url}
                    index={ii}
                    filePath={e}
                    dirPath={fp}
                />
            );
        });
    };

    const renderPath = () => {
        if (!path) {
            return null;
        }

        const parentPath = getDir(path);
        const toUrl = (clientUtil as any).getExplorerLink(parentPath);

        return (
            <div className="one-book-path">
                <Link target="_blank" to={toUrl}>
                    {parentPath}{" "}
                </Link>
            </div>
        );
    };

    if (isFailedLoading()) {
        const fp = getTextFromQuery();
        return <ErrorPage res={res} filePath={fp} />;
    }

    const bookTitle = (
        <div className="one-book-title">
            <FileNameDiv filename={getBaseName(path)} />
            {renderPath()}
        </div>
    );

    useEffect(() => {
        if (path) {
            document.title = getBaseName(path);
        }
    }, [path]);

    if (_.isEmpty(imageFiles) && _.isEmpty(musicFiles)) {
        if (res && !(res as any).isFailed()) {
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

    return (
        <div className="one-book-overview-container container">
            {bookTitle}
            <div className="row">{renderImageGrid()}</div>
        </div>
    );
};

export default withRouter(BookOverviewPage);
