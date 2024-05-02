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

import { GlobalContext } from './globalContext'


const ClientConstant = require("./ClientConstant");
const { BY_FILE_NUMBER,
    BY_TIME,
    BY_MTIME,
    BY_LAST_READ_TIME,
    BY_READ_COUNT,
    BY_FILE_SIZE,
    BY_AVG_PAGE_SIZE,
    BY_PAGE_NUMBER,
    BY_FILENAME,
    BY_GOOD_SCORE,
    BY_FOLDER,
    BY_RANDOM } = ClientConstant;

const { MODE_TAG,
    MODE_AUTHOR,
    MODE_SEARCH,
    MODE_EXPLORER } = Constant;

const GOOD_STANDARD = 2;

const FILTER_GOOD_AUTHOR = "FILTER_GOOD_AUTHOR";
const FILTER_OVERSIZE = "FILTER_OVERSIZE";
const FILTER_FIRST_TIME_AUTHOR = "FILTER_FIRST_TIME_AUTHOR";
const FILTER_HAS_MUSIC = "FILTER_HAS_MUSIC";
const FILTER_HAS_VIDEO = "FILTER_HAS_VIDEO";
const FILTER_IMG_FOLDER = "FILTER_IMG_FOLDER";


export const NoScanAlertArea = ({filePath}) => {
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
            <div style={{ marginBottom: "5px" }}>{`It is usable, but lack some good features (e.g tags, search)`}</div>
            <div className="scan-button" onClick={askSendScan}>Scan this Folder (but it will take time)</div>
        </div>)
}


export const FileCountPanel = ({filteredFiles, filteredVideos, info}) => {
    const totalZipSize = info.countAllFileSize(filteredFiles);
    const totalVideoSize = info.countAllFileSize(filteredVideos);
    const totalSize = totalZipSize + totalVideoSize;
    const title = `${filesizeUitl(totalZipSize)} zips and ${filesizeUitl(totalVideoSize)} videos`
    const totalPageNum = info.countAllFilePageNum(filteredFiles);
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

export const LinkToEHentai = ({ searchable, text  }) => {
    const link = "https://exhentai.org/?f_search=" + searchable;
    const title = "Search '" + searchable + "' in Exhentai";

    return (<center className={"location-title"}>
        <a className="explorer-external-link" target="_blank" href={link} title={title}>{text} </a>
        <ClickAndCopyDiv text={searchable} />
    </center>);
}


export const getOneLineListItem = (icon, fileName, filePath, info ) => {
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

