// @flow
import React, { Component } from 'react';
import _ from "underscore";
// import './style/Explorer.scss';
import LoadingImage from './LoadingImage';
import Sender from './Sender';
import { Link } from 'react-router-dom';

const userConfig = require('@config/user-config');
import ErrorPage from './ErrorPage';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import CenterSpinner from './subcomponent/CenterSpinner';
const util = require("@common/util");
const queryString = require('query-string');
import Pagination from './subcomponent/Pagination';
import ItemsContainer from './subcomponent/ItemsContainer';
import SortHeader from './subcomponent/SortHeader';
import Breadcrumb from './subcomponent/Breadcrumb';
import FileCellTitle from './subcomponent/FileCellTitle';
import ClickAndCopyDiv from './subcomponent/ClickAndCopyDiv';
import Checkbox from './subcomponent/Checkbox';
import ThumbnailPopup from './subcomponent/ThumbnailPopup';
import { getFileUrl } from './clientUtil';
const nameParser = require('@name-parser');
const classNames = require('classnames');
const Constant = require("@common/constant");
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil;
const { isVideo, isCompress, isImage, isMusic } = util;
// const sortUtil = require("../common/sortUtil");
const AdminUtil = require("./AdminUtil");
import Swal from 'sweetalert2';
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';

// import { GlobalContext } from './globalContext'


const ClientConstant = require("./ClientConstant");
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
// const FILTER_HAS_MUSIC = "FILTER_HAS_MUSIC";
// const FILTER_HAS_VIDEO = "FILTER_HAS_VIDEO";
// const FILTER_IMG_FOLDER = "FILTER_IMG_FOLDER";





export const NoScanAlertArea = ({ filePath }) => {
    // const [minifyZipQue, setMinifyZipQue] = useState([]);

    const askSendScan = () => {
        Swal.fire({
            title: "Scan this Folder (but it will take time)",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.post("/api/addNewFileWatchAfterInit", { filePath }, res => {
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
            <div style={{ marginBottom: "5px" }}>{`It is usable, but it lacks some important features, such as tags and search.`}</div>
            <div className="scan-button" onClick={askSendScan}>Scan this Folder (but it will take time)</div>
        </div>)
}


function countAllFileSize(files) {
    let totalSize = 0;
    files.forEach(e => {
        totalSize += e.fileSize;
    });
    return totalSize;
}

function countAllFilePageNum(filteredFiles) {
    let count = 0;
    filteredFiles.forEach(e => {
        count += e.pageNum;
    });
    return count;
}

export const FileCountPanel = ({ filteredFiles, filteredVideos, info }) => {
    const totalZipSize = countAllFileSize(filteredFiles);
    const totalVideoSize = countAllFileSize(filteredVideos);
    const totalSize = totalZipSize + totalVideoSize;
    const title = `${filesizeUitl(totalZipSize)} zips and ${filesizeUitl(totalVideoSize)} videos`
    const totalPageNum = countAllFilePageNum(filteredFiles);
    return (
        <div className="row">
            <div className="col-12 file-count-row">
                <div className="file-count">{"Zip: " + filteredFiles.length} </div>
                <div className="file-count">{"Page: " + totalPageNum} </div>
                <div className="file-count">{"Video: " + filteredVideos.length} </div>
                <div className="file-count">{"Music: " + info.musicFiles.length} </div>
                <div className="file-count">{"Image: " + info.imageFiles.length} </div>
                <div className="file-count">{"Folder: " + info.dirs.length} </div>
                <div className="file-count" title={title}>{"Total: " + filesizeUitl(totalSize)} </div>
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


export const OneLineListItem = ({icon, fileName, item, info}) => {
    // TODO
    return (
        <li className="explorer-one-line-list-item" key={fileName} title={info.getTooltipStr(item)}>
            {icon}
            <span className="explorer-one-line-list-item-text">{fileName}</span>
        </li>);
}

export const SimpleFileListPanel = ({ musicFiles, imageFiles, info }) => {
    const musicItems = musicFiles.map((item) => {
        const toUrl = clientUtil.getOneBookLink(getDir(item));
        const text = getBaseName(item);
        const result = (<OneLineListItem  icon={<i className="fas fa-volume-up"></i>} fileName={text} item={item} info={info} />);
        return <Link target="_blank" to={toUrl} key={text}>{result}</Link>;
    });

    const imageItems = imageFiles.map((item) => {
        const toUrl = clientUtil.getOneBookLink(getDir(item));
        const text = getBaseName(item);
        const result = (<OneLineListItem  icon={<i className="fas fa-images"></i>} fileName={text} item={item} info={info}/>);
        return <Link target="_blank" to={toUrl} key={text}>{result}</Link>;
    });

    return (<>
        <ItemsContainer items={musicItems} />
        <ItemsContainer items={imageItems} />
    </>)

}

export const SingleZipItem = ({ filePath, info, item }) => {
    const fp = filePath;
    const text = item.fileName;
    const toUrl = clientUtil.getOneBookLink(fp);

    let zipItem;
    let thumbnailurl = info.getThumbnailUrl(item);

    const fileSizeStr = item.fileSize && filesizeUitl(item.fileSize);

    const avgSize = item.pageAvgSize;
    const avgSizeStr = avgSize > 0 && filesizeUitl(avgSize);

    const musicNum = item.musicNum;
    const hasMusic = musicNum > 0;
    const pageNum = item.pageNum;
    const isImgFolder = item.isImgFolder;

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
        title={info.getTooltipStr(item)}
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
                    {fileSizeStr && <span title="file size">{fileSizeStr}</span>}
                    <span>{`${pageNum} pages`}</span>
                    {hasMusic && <span>{`${musicNum} songs`}</span>}
                    {avgSizeStr && <span title="average img size"> {avgSizeStr} </span>}
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

    // TODO
    const byDir = _.groupBy(files, e => getDir(e.filePath));
    let fDirs = _.keys(byDir);
    // 文件夹根据所拥有文件件的时间来排序
    fDirs = _.sortBy(fDirs, dirPath => {
        const files = byDir[dirPath];
        const times = files.map(ff => ff.mtimeMs).filter(e => !!e);
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

