// @flow
import React, { Component } from 'react';
import _ from "underscore";
// import './style/Explorer.scss';
import LoadingImage from './LoadingImage';
import Sender from '@services/Sender';
import { Link } from 'react-router-dom';

const userConfig = require('@config/user-config');
import ErrorPage from '@pages/ErrorPage';
import FileChangeToolbar from './common/FileChangeToolbar';
import CenterSpinner from './common/CenterSpinner';
const util = require("@common/util");
const queryString = require('query-string');
import Pagination from './common/Pagination';
import ItemsContainer from './common/ItemsContainer';
import SortHeader from './common/SortHeader';
import Breadcrumb from './common/Breadcrumb';
import FileCellTitle from './common/FileCellTitle';
import ClickAndCopyDiv from './common/ClickAndCopyDiv';
import Checkbox from './common/Checkbox';
import ThumbnailPopup from './common/ThumbnailPopup';
import { getFileUrl } from '@utils/clientUtil';
const nameParser = require('@name-parser');
const classNames = require('classnames');
const Constant = require("@common/constant");
const clientUtil = require("@utils/clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil;
const { isVideo, isCompress, isImage, isMusic } = util;
// const sortUtil = require("../common/sortUtil");
const AdminUtil = require("@utils/AdminUtil");
import Swal from 'sweetalert2';
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';

// import { GlobalContext } from './globalContext'


const ClientConstant = require("@utils/ClientConstant");
// const { BY_FILE_NUMBER,
//     BY_TIME,
//     BY_MTIME,
//     BY_LAST_READ_TIME,
//     BY_READ_COUNT,
//     BY_FILE_SIZE,
//     BY_AVG_PAGE_SIZE,
//     BY_PAGE_NUMBER,
//     BY_FILENAME,
//     BY_GOOD_SCORE,
//     BY_FOLDER,
//     BY_RANDOM } = ClientConstant;

// const { MODE_TAG,
//     MODE_AUTHOR,
//     MODE_SEARCH,
//     MODE_EXPLORER } = Constant;

// const GOOD_STANDARD = 2;

// const FILTER_GOOD_AUTHOR = "FILTER_GOOD_AUTHOR";
// const FILTER_OVERSIZE = "FILTER_OVERSIZE";
// const FILTER_FIRST_TIME_AUTHOR = "FILTER_FIRST_TIME_AUTHOR";
// const FILTER_HAS_MUSIC = "FILTER_HAS_MUSIC";
// const FILTER_HAS_VIDEO = "FILTER_HAS_VIDEO";
// const FILTER_IMG_FOLDER = "FILTER_IMG_FOLDER";


export const NoScanAlertArea = ({ filePath }) => {
    // const [minifyZipQue, setMinifyZipQue] = useState([]);

    const askSendScan = () => {
        Swal.fire({
            title: "Scan Folder",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.post("/api/folder/add_file_watch", { filePath }, res => {
                    if (!res.isFailed()) {
                        // let { minifyZipQue } = res.json;
                        // setMinifyZipQue(minifyZipQue)
                    }
                });
            }
        });
    }

    return (
        <div className="alert alert-warning" role="alert" >
            <div>{`${filePath} is not included in config-path`}</div>
            <div style={{ marginBottom: "5px" }}>{`It's usable but still missing important features like tags and search.`}</div>
            <div className="scan-button" onClick={askSendScan}>Scan Folder</div>
        </div>)
}


export const FileCountPanel = ({ filteredFiles, filteredVideos, info }) => {
    const totalZipSize = info.countAllFileSize(filteredFiles);
    const totalVideoSize = info.countAllFileSize(filteredVideos);
    const totalSize = totalZipSize + totalVideoSize;
    const title = `${filesizeUitl(totalZipSize)} zips and ${filesizeUitl(totalVideoSize)} videos`
    const totalPageNum = info.countAllFilePageNum(filteredFiles);
    const fileCountItems = [
        {
            key: 'zip',
            icon: 'fas fa-archive',
            label: 'Zip',
            value: filteredFiles.length,
        },
        {
            key: 'page',
            icon: 'fas fa-file-alt',
            label: 'Page',
            value: totalPageNum,
        },
        {
            key: 'video',
            icon: 'fas fa-video',
            label: 'Video',
            value: filteredVideos.length,
        },
        {
            key: 'music',
            icon: 'fas fa-music',
            label: 'Music',
            value: info.musicFiles.length,
        },
        {
            key: 'image',
            icon: 'fas fa-images',
            label: 'Image',
            value: info.imageFiles.length,
        },
        {
            key: 'folder',
            icon: 'fas fa-folder-open',
            label: 'Folder',
            value: info.dirs.length,
        },
        {
            key: 'total',
            icon: 'fas fa-database',
            label: 'Total',
            value: filesizeUitl(totalSize),
            title,
        },
    ];
    return (
        <div className="row">
            <div className="col-12 file-count-row">
                {fileCountItems.map(({ key, icon, label, value, title: itemTitle }) => (
                    <div className="file-count" key={key} title={itemTitle}>
                        <i className={`file-count__icon ${icon}`} aria-hidden="true"></i>
                        <div className="file-count__content">
                            <div className="file-count__label">{label}</div>
                            <div className="file-count__value">{value}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const LinkToEHentai = ({ searchable, text }) => {
    const link = "https://exhentai.org/?f_search=" + searchable;
    const title = "Search '" + searchable + "' in Exhentai";

    return (<center className={"location-title"}>
        <a className="explorer-external-link" target="_blank" href={link} title={title}>{text} </a>
        <ClickAndCopyDiv text={searchable} />
    </center>);
}


export const getOneLineListItem = (icon, fileName, filePath, info) => {
    return (
        <li className="explorer-one-line-list-item" key={fileName} title={info.getTooltipStr(filePath)}>
            {icon}
            <span className="explorer-one-line-list-item-text">{fileName}</span>
        </li>);
}

export const SimpleFileListPanel = ({ musicFiles, imageFiles, info }) => {
    const musicItems = musicFiles.map((item) => {
        const toUrl = clientUtil.getOneBookLink(getDir(item));
        const text = getBaseName(item);
        const result = getOneLineListItem(<i className="fas fa-volume-up"></i>, text, item, info);
        return <Link target="_blank" to={toUrl} key={item}>{result}</Link>;
    });

    const imageItems = imageFiles.map((item) => {
        const toUrl = clientUtil.getOneBookLink(getDir(item));
        const text = getBaseName(item);
        const result = getOneLineListItem(<i className="fas fa-images"></i>, text, item, info);
        return <Link target="_blank" to={toUrl} key={item}>{result}</Link>;
    });

    return (<>
        <ItemsContainer items={musicItems} />
        <ItemsContainer items={imageItems} />
    </>)

}

export const SingleZipItem = ({ filePath, info }) => {
    const fp = filePath;
    const text = getBaseName(fp);
    const toUrl = clientUtil.getOneBookLink(fp);

    let zipItem;
    let thumbnailurl = info.getThumbnailUrl(fp);


    const fileSize = info.hasFileSize(fp) && info.getFileSize(fp);
    const fileSizeStr = fileSize && filesizeUitl(fileSize);

    const avgSize = info.getPageAvgSize(fp);
    const avgSizeStr = avgSize > 0 && filesizeUitl(avgSize);

    const musicNum = info.getMusicNum(fp);
    const isImgFolder = info.isImgFolder(fp);
    const hasMusic = musicNum > 0;
    const pageNum = info.getPageNum(fp);

    const fileInfoRowCn = classNames("file-info-row", {
        "less-padding": hasMusic
    })

    const thumbnailCn = classNames("file-cell-thumbnail", {
        "as-folder-thumbnail": isImgFolder
    });

    let imgDiv = (
    <LoadingImage
        mode={"zip"}
        className={thumbnailCn}
        title={info.getTooltipStr(fp)}
        fileName={fp}
        url={thumbnailurl}
        musicNum={musicNum}
    />);

    if (isImgFolder) {
        imgDiv = (<div className="folder-effect"> {imgDiv} </div>)
    }

    zipItem = (
        <div key={fp} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
            <div className="file-cell">
                <Link target="_blank" to={toUrl} key={fp} className={"file-cell-inner"}>
                    <FileCellTitle str={text} />
                    {imgDiv}
                </Link>
                <div className={fileInfoRowCn}>
                    {fileSizeStr && <span title="File Size">{fileSizeStr}</span>}
                    <span>{`${pageNum} pages`}</span>
                    {hasMusic && <span>{`${musicNum} songs`}</span>}
                    {avgSizeStr && <span title="Average Image Size"> {avgSizeStr} </span>}
                </div>
                <FileChangeToolbar isFolder={isImgFolder} hasMusic={hasMusic} className="explorer-file-change-toolbar" file={fp} />
            </div>
        </div>);

    return zipItem;
}


export const FileGroupZipPanel = ({
    files,
    isSortAsc,
    info
}) => {
    const byDir = _.groupBy(files, getDir);
    let fDirs = _.keys(byDir);
    // 文件夹根据所拥有文件件的时间来排序
    fDirs = _.sortBy(fDirs, dirPath => {
        const files = byDir[dirPath];
        const times = files.map(fp => info.getMtime(fp)).filter(e => !!e);
        const avgTime = util.getAverage(times);
        return avgTime || 0;
    });

    if (isSortAsc) {
        fDirs.reverse();
    }

    const zipfileItems = [];
    fDirs.map((dirPath, ii) => {
        const folderGroup = byDir[dirPath];
        const extraDiv = (<div className="extra-div" >{`Zip: ${folderGroup.length}`} </div>);
        const seperator = (<div className="col-12" key={dirPath + "---seperator"}>
            <Breadcrumb sep={info.context.file_path_sep}
                server_os={info.context.server_os}
                path={dirPath}
                className={ii > 0 ? "not-first-breadcrumb folder-seperator" : "folder-seperator"}
                extraDiv={extraDiv}
            />

        </div>);
        zipfileItems.push(seperator)
        const zipGroup = folderGroup.map(fp => info.renderSingleZipItem(fp));
        zipfileItems.push(...zipGroup);
    })

    return <>{ zipfileItems } </>;
}

//-----------------------------------------


function parse(str) {
    return nameParser.parse(getBaseName(str));
}

function _parseInt(val) {
    if (_.isNumber(val)) {
        return val;
    } else {
        return parseInt(val);
    }
}

