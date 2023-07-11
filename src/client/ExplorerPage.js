// @flow
import React, { Component } from 'react';
import _ from "underscore";
import './style/Explorer.scss';
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

function NoScanAlertArea(props){
    // const [minifyZipQue, setMinifyZipQue] = useState([]);
    const {filePath} = props;


    const askSendScan =() => {
        Swal.fire({
            title: "Scan this Folder (but it will take time)",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.post("/api/addNewFileWatchAfterInit", {filePath}, res => {
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
            <div style={{marginBottom:"5px"}}>{`It is usable, but lack some good features`}</div>
            <div className="scan-button" onClick={askSendScan}>Scan this Folder (but it will take time)</div>
        </div>)
}


function parse(str) {
    return nameParser.parse(getBaseName(str));
}

function _parseInt(val){
    if(_.isNumber(val)){
        return val;
    }else{
        return parseInt(val);
    }
}


export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);

        this.metaInfo = [
            {key:"pageIndex", type: "int", defVal: 1},
            {key:"isRecursive", type: "boolean", defVal: false},
            {key:"sortOrder", type: "str", defVal: BY_TIME},
            {key:"isSortAsc", type: "boolean", defVal: false},
            {key:"showVideo", type: "boolean", defVal: true},
            {key:"showFolderThumbnail", type: "boolean", defVal: false},
            {key:"filterArr", type: "arr"},
            {key:"filterText", type: "str"},
            {key:"filterType", type: "str"},
            {key:"noThumbnail", type: "boolean", defVal: false}
        ];

        this.state = this.getInitState();
        this.resetParam();
    }

    getNumPerPage() {
        return (this.state.noThumbnail || this.state.sortOrder === BY_FOLDER)? 
                1000 : this.state.perPageItemNum;
    }

    getInitState(reset) {
        const initState = clientUtil.getInitState(this.metaInfo, reset);
        return {
            perPageItemNum: getPerPageItemNumber(),
            ...initState
        }
    }

    setStateAndSetHash(state, callback) {
        this.setState(state, callback);
        const newState = {...this.state, ...state};
        clientUtil.saveStateToUrl(this.metaInfo, newState);
    }

    handlePageChange(index) {
        if (window.event && window.event.ctrlKey) {
            return;
        }
        this.setStateAndSetHash({ pageIndex: index });
    }

    next() {
        if (this.pagination && this.pagination.hasNext()) {
            let next = this.state.pageIndex + 1;
            this.handlePageChange(next);
        }
    }

    prev() {
        if (this.pagination && this.pagination.hasPrev()) {
            let next = this.state.pageIndex - 1;
            this.handlePageChange(next);
        }
    }

    getPathFromQuery(props) {
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["p"] || "";
    }

    getSearchTextFromQuery(props) {
        // https://en.wikipedia.org/wiki/URL
        // e.g ?s=apple
        const _props = props || this.props;
        if (this.getMode(_props) === MODE_SEARCH) {
            let str = _props.location.search || _props.location.pathname;
            str = str.replace("/search/?", "")
            return queryString.parse(str)["s"] || "";
        }
    }

    getAuthorFromQuery(props) {
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["a"] || "";
    }

    getTagFromQuery(props) {
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["t"] || "";
    }

    getTextFromQuery(props) {
        const _props = props || this.props;
        return this.getTagFromQuery(_props) ||
            this.getAuthorFromQuery(_props) ||
            this.getSearchTextFromQuery(_props) ||
            this.getPathFromQuery(_props);
    }

    getMode(props) {
        const _props = props || this.props;
        const pathname = _props.location.pathname;
        if (pathname.includes("/tag/")) {
            return MODE_TAG;
        } else if (pathname.includes("/author/")) {
            return MODE_AUTHOR;
        } else if (pathname.includes("/explorer/")) {
            return MODE_EXPLORER;
        } else if (pathname.includes("/search/")) {
            return MODE_SEARCH;
        }
    }

    static getDerivedStateFromProps(nextProps, prevState){
        if (_.isString(nextProps.filterText) && nextProps.filterText !== prevState.filterText) {
            return {
                filterText: nextProps.filterText,
                pageIndex: 1
            }
        }
        return null;
    }

    async askServer() {
        let res;
        if (this.getMode() === MODE_EXPLORER) {
            const hash = this.getTextFromQuery();
            if (hash && this.loadedHash !== hash) {
                res = await Sender.postWithPromise('/api/lsDir', { dir: this.getTextFromQuery(), isRecursive: this.state.isRecursive });
                this.handleLsDirRes(res);
            }
        } else {
            const hash = this.getTextFromQuery();
            if (hash && this.loadedHash !== hash) {
                if (this.getMode() === MODE_TAG) {
                    res = await Sender.postWithPromise("/api/search", { text: this.getTextFromQuery(), mode: this.getMode() })
                } else if (this.getMode() === MODE_AUTHOR) {
                    res = await Sender.postWithPromise("/api/search", { text: this.getTextFromQuery(), mode: this.getMode() })
                } else if (this.getMode() === MODE_SEARCH) {
                    res = await Sender.postWithPromise("/api/search", { text: this.getSearchTextFromQuery(), mode: this.getMode() })
                }
            }
            this.handleLsDirRes(res);
        }
    }


    componentDidMount() {
        this.askServer();

        this.bindUserInteraction();
    }

    bindUserInteraction() {
        this._handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this._handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this._handleKeyDown);

        clientUtil.setSearchInputText("");
    }

    resetParam() {
        this.loadedHash = "";
        this.videoFiles = []
        this.compressFiles = [];
        this.imageFiles = [];
        this.musicFiles = [];
        this.dirs = [];
        this.tag = "";
        this.author = "";
        this.fileInfos = {};
        this.imgFolderInfo = {};
        this.res = null;
        this.dirThumbnailMap = {};
    }

    componentDidUpdate(prevProps, prevState) {
        //when path changes, does not show previous path's content 
        const prevMode = this.getMode(prevProps);
        const prevHash = this.getTextFromQuery(prevProps);
        const differentMode = this.getMode() !== prevMode;
        const sameMode = !differentMode;
        const pathChanged = !!(sameMode && this.getTextFromQuery() !== prevHash);
        if (differentMode || pathChanged) {
            this.resetParam();
            this.setStateAndSetHash(this.getInitState(true));
            this.askServer();
        }

        if (this.getMode() === MODE_TAG || this.getMode() === MODE_AUTHOR || this.getMode() === MODE_SEARCH) {
            const text = this.getTextFromQuery();
            clientUtil.setSearchInputText(text);
        } else {
            clientUtil.setSearchInputText("");
        }
    }

    isLackInfoMode() {
        return this.mode === "lack_info_mode";
    }


    handleLsDirRes(res) {
        if (!res.isFailed()) {
            let { 
                dirs=[], 
                mode, 
                tag="", 
                author="", 
                fileInfos={}, 
                imgFolderInfo={}, 
                fileHistory=[],
                nameParseCache={}
            } = res.json;

            // 马上叫server准备下一个信息
            Sender.get('/api/getGoodAuthorNames', res => {
                if (!res.isFailed()) {
                    this.setState({
                        authorInfo: res.json.authorInfo,
                        tagInfo: res.json.tagInfo
                    })
                }
            });

            nameParser.setLocalCache(nameParseCache);
            this.loadedHash = this.getTextFromQuery();
            this.mode = mode;
            this.fileInfos = fileInfos;
            const files = _.keys(this.fileInfos) || [];
            this.videoFiles = files.filter(isVideo);
            this.compressFiles = files.filter(isCompress);
            this.musicFiles = files.filter(isMusic);
            this.imageFiles = files.filter(isImage);

            sortFileNames(this.musicFiles)
            sortFileNames(this.imageFiles)

            this.dirs = dirs;
            this.dirs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            this.tag = tag;
            this.author = author;
            this.imgFolderInfo = imgFolderInfo;
            this.res = res;
            this.allfileInfos = _.extend({}, this.fileInfos, this.imgFolderInfo);
            this.decorate_allfileInfos();

            this.fileNameToHistory = {};
            fileHistory.forEach(row => {
                const { fileName, time, count } = row;
                this.fileNameToHistory[fileName] = {time, count};
            })

            if (this.videoFiles.length > 0 && !this.state.showVideo) {
                this.setStateAndSetHash({
                    showVideo: true
                });
            }

            //check pageindex
            const availableFiles = this.getFileInPage(this.getFilteredFiles());

            if (availableFiles.length === 0) {
                //this will set state
                this.handlePageChange(1);
            } else {
                this.askRerender();
            }

            this.hasCalled_getThumbnailForFolders = false;
            if(this.state.showFolderThumbnail){
                this.requestThumbnailForFolder();
            }
        } else {
            this.res = res;
            this.askRerender();
        }
    }

    decorate_allfileInfos(){
        // this.allfileInfos
        for(const fp in this.allfileInfos){
            if(!this.allfileInfos.hasOwnProperty(fp)){
                continue;
            }

            const info = this.allfileInfos[fp];
            info.size = _parseInt(info.size) || 0;
            info.mtimeMs = _parseInt(info.mtimeMs) || 0;

            info.musicNum = _parseInt(info.musicNum) || 0;
            info.videoNum = _parseInt(info.videoNum) || 0;
            info.pageNum = _parseInt(info.pageNum) || 0;

            info.totalImgSize = _parseInt(info.totalImgSize) || 0;
            info.pageAvgSize = this.calculateAvgPageSize(fp) || 0;
        }
    }

    calculateAvgPageSize(fp){
        //may not be reliable
        const pageNum = this.getPageNum(fp);
        if (pageNum === 0) {
            return 0;
        }

        let total;
        if (this.getFileSize(fp) === 0) {
            total = this.getTotalImgSize(fp);
        } else {
            total = Math.min(this.getFileSize(fp), this.getTotalImgSize(fp))
        }
        return total / pageNum;
    }

    handleKeyDown(event) {
        //this cause input wont work 
        if (isSearchInputTextTyping()) {
            return;
        }

        const key = event.key.toLowerCase();
        if (key === "arrowright" || key === "d" || key === "l") {
            this.next();
            event.preventDefault();
        } else if (key === "arrowleft" || key === "a" || key === "j") {
            this.prev();
            event.preventDefault();
        }else if (key == "r"){
            this.loadedHash = ""; // 感觉这玩意是个错误design
            this.askServer();
        }
    }

    hasFileSize(e) {
        return !!this.getFileSize(e);
    }

    countAllFileSize(files) {
        let totalSize = 0;
        files.forEach(e => {
            totalSize += this.getFileSize(e);
        });
        return totalSize;
    }

    countAllFilePageNum(filteredFiles) {
        let count = 0;
        filteredFiles.forEach(e => {
            count += this.getPageNum(e);
        });
        return count;
    }

    getFileSize(fp) {
        return this.allfileInfos[fp]?.size || 0;
    }

    getPageNum(fp) {
        return this.allfileInfos[fp]?.pageNum || 0;
    }

    getTotalImgSize(fp) {
        return this.allfileInfos[fp]?.totalImgSize || 0;
    }

    //may not be reliable
    getPageAvgSize(fp) {
        return this.allfileInfos[fp]?.pageAvgSize || 0;
    }

    getMusicNum(fp) {
        return this.allfileInfos[fp]?.musicNum || 0;
    }

    getVideoNum(fp) {
        return this.allfileInfos[fp]?.videoNum || 0;
    }

    getMtime(fp){
        return this.allfileInfos[fp]?.mtimeMs || 0;
    }

    /** get tag time */
    getTTime(fp){
        const fn = getBaseName(fp);
        let tTime = nameParser.getDateFromParse(fn);
        tTime = tTime && tTime.getTime();
        return tTime || 0;
    }

    getReadCount(fp){
        const fn = getBaseName(fp);
        const count = _parseInt(this.fileNameToHistory[fn]?.count);
        return count || 0;
    }

    getLastReadTime(fp){
        const fn = getBaseName(fp);
        const rTime = _parseInt(this.fileNameToHistory[fn]?.time);
        return rTime || 0;
    }
    
    getFilteredFiles() {
        let files = [...this.compressFiles, ...(_.keys(this.imgFolderInfo))];

        const { authorInfo } = this.state;

        if (this.isOn(FILTER_GOOD_AUTHOR) && authorInfo) {
            files = files.filter(e => {
                const count = this.getAuthorCountForFP(e);
                if (count && count.good_count > GOOD_STANDARD) {
                    return true;
                }
            })
        }

        if (this.isOn(FILTER_FIRST_TIME_AUTHOR) && authorInfo) {
            files = files.filter(e => {
                const count = this.getAuthorCountForFP(e);
                if (count && (count.total_count) === 1) {
                    return true;
                }
            })
        }

        if (this.isOn(FILTER_OVERSIZE)) {
            files = files.filter(e => {
                return this.getPageAvgSize(e) / 1024 / 1024 > userConfig.oversized_image_size
            })
        }

        if (this.isOn(FILTER_HAS_MUSIC)) {
            files = files.filter(e => {
                return this.getMusicNum(e) > 0;
            })
        }

        if (this.isOn(FILTER_HAS_VIDEO)) {
            files = files.filter(e => {
                return this.getVideoNum(e) > 0;
            })
        }

        if (this.isOn(FILTER_IMG_FOLDER)) {
            files = files.filter(e => {
                return !isCompress(e);
            })
        }

        const filterText = _.isString(this.state.filterText) && this.state.filterText.toLowerCase();
        if (filterText) {
            files = files.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }

        const filterType = _.isString(this.state.filterType) && this.state.filterType;
        if (filterType) {
            files = files.filter(e => {
                const result = parse(e);
                return result && result.type === filterType;
            });
        }

        // 没有zip信息会被误会为没有，拿掉。
        // if (userConfig.filter_empty_zip) {
        //     files = files.filter(e => {
        //         if (this.getMusicNum(e) === 0 && this.getPageNum(e) === 0 && this.getVideoNum(e) === 0) {
        //             return false;
        //         }
        //         return true;
        //     });
        // }
        return files;
    }

    getFilteredVideos() {
        if (!this.state.showVideo) {
            return [];
        }

        const { filterByGoodAuthorName, filterByOversizeImage, filterByGuess, filterByFirstTime, filterByHasMusic } = this.state;
        let videoFiles;
        if (filterByGoodAuthorName || filterByOversizeImage || filterByGuess || filterByFirstTime || filterByHasMusic) {
            videoFiles = [];
        } else {
            videoFiles = this.videoFiles || [];
        }

        const filterText = this.state.filterText && this.state.filterText.toLowerCase();
        if (filterText) {
            return videoFiles.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        } else {
            return videoFiles;
        }
    }

    getFileInPage(files) {
        return files.slice((this.state.pageIndex - 1) * this.getNumPerPage(), (this.state.pageIndex) * this.getNumPerPage());
    }

    sortFiles(files, sortOrder, isSortAsc) {
        //-------sort algo
        const byFn = (a, b) => {
            const ap = getBaseName(a);
            const bp = getBaseName(b);
            return ap.localeCompare(bp);
        }


        // 一律先时间排序
        // const onlyByMTime = this.getMode() === MODE_EXPLORER && !this.isLackInfoMode();
        // const config = {
        //     fileInfos: this.allfileInfos,
        //     ascend: true,
        //     getBaseName,
        //     onlyByMTime
        // }
        // sortUtil.sort_file_by_time(files, config);
        // 下方的sort都是stable sort。
        files = _.sortBy(files, e => {
            // 没有信息，排到前面来触发后端get thumbnail。获得信息
            const mtime = this.getMtime(e);
            const ttime = this.getTTime(e);

            if(mtime && ttime){
                const gap = Math.abs(mtime  - ttime);
                const GAP_THRESHOLD = 180 * 24 * 3600 * 1000;
                if(gap > GAP_THRESHOLD){
                    return Math.min(mtime, ttime) || Infinity;
                } else {
                    return mtime || Infinity;
                }
            }else{
                return mtime || ttime;
            }
        });

        if (sortOrder === BY_RANDOM) {
            files = _.shuffle(files);
        } else if (sortOrder === BY_FILENAME) {
            files.sort((a, b) => {
                return byFn(a, b);
            });
        }else if (sortOrder == BY_GOOD_SCORE){
            // 喜好排序
            files.sort((a, b)=> {
                const s1 = this.getScore(a);
                const s2 = this.getScore(b);
                return s1 - s2;
            })
        } else if (sortOrder === BY_FOLDER) {
            files = _.sortBy(files, e => {
                const dir = getDir(e);
                return dir;
            });
        } else if (sortOrder === BY_TIME) {
            // pass
        } else if (sortOrder === BY_MTIME) {
            //只看mtime
            files = _.sortBy(files, e => {
                const mtime = this.getMtime(e);
                return mtime || Infinity;
            });
        } else if (sortOrder === BY_LAST_READ_TIME) {
            files = _.sortBy(files, e => {
                return this.getLastReadTime(e);
            });
        } else if (sortOrder === BY_READ_COUNT) {
            files = _.sortBy(files, e => {
                return this.getReadCount(e);
            });
        } else if (sortOrder === BY_FILE_SIZE) {
            files = _.sortBy(files, e => {
                return this.getFileSize(e);
            });
        } else if (sortOrder === BY_AVG_PAGE_SIZE) {
            files = _.sortBy(files, e => {
                return this.getPageAvgSize(e);
            });
        } else if (sortOrder === BY_PAGE_NUMBER) {
            files = _.sortBy(files, e => {
                return this.getPageNum(e);
            });
        }

        if (!isSortAsc) {
            files.reverse();
        }

        return files;
    }

    getOneLineListItem(icon, fileName, filePath, title) {
        return (
            <li className="explorer-one-line-list-item" key={fileName} title={this.getTooltipStr(filePath)}>
                {icon}
                <span className="explorer-one-line-list-item-text">{fileName}</span>
            </li>);
    }

    getScore(fp) {
        let score = this.getAuthorCountForFP(fp).score || 0;
        // console.log(fp)
        const { good_folder_root, not_good_folder_root } = this.context;
        if(good_folder_root && fp.includes(good_folder_root)){
            score += 1;
        }else if(not_good_folder_root && fp.includes(not_good_folder_root)){
            score -= 1;
        }
        return score;
    }

    getAuthorCountForFP(fp) {
        const temp = parse(fp);
        if(temp && temp.authors){
            // todo multiple-author
            return clientUtil.getAuthorCount(this.state.authorInfo, temp.authors[0]) || {};
        }else{
            return {};
        }
    }

    // getTagCountForFP(fp) {
    //     const temp = parse(fp);
    //     if(temp && temp.tags){
    //         return temp.tags.map(tag => {
    //             return clientUtil.getAuthorCount(this.state.tagInfo, tag) || [];
    //         });
    //     }else{
    //         return [];
    //     }
    // }
    

    getTooltipStr(fp){
        let rows = [];
        rows.push([fp]);

        rows.push(["mtime", clientUtil.dateFormat_v1(this.getMtime(fp))]);
        rows.push(["tag time", clientUtil.dateFormat_v1(this.getTTime(fp))]);

        rows.push(["     "]);
        rows.push(...clientUtil.convertSimpleObj2tooltipRow(this.getAuthorCountForFP(fp)));
        // rows.push(["score", this.getScore(fp)]);

        // tag score不精确
        // this.getTagCountForFP(fp).forEach(ee => {
        //     rows.push(["     "]);
        //     rows.push(...clientUtil.convertSimpleObj2tooltipRow(ee));
        // })

        rows.push(["     "]);
        rows.push(["last read time", clientUtil.dateFormat_v1(this.getLastReadTime(fp))]);
        rows.push(["read count", this.getReadCount(fp)]);

        return rows.map(row => {
            return row.join(": ");
        }).join("\n")
    }

    isImgFolder(fp){
        return !!this.imgFolderInfo[fp];
    }

    getThumbnailUrl(fp){
        let thumbnailurl;
        if (this.isImgFolder(fp)) {
            const tp = this.imgFolderInfo[fp].thumbnail;
            thumbnailurl = getFileUrl(tp, true);
        } else {
            thumbnailurl = getFileUrl(this.allfileInfos[fp].thumbnailFilePath, true);
        }
        return thumbnailurl;
    }

    renderSingleZipItem(fp) {
        const text = getBaseName(fp);
        const toUrl = clientUtil.getOneBookLink(fp);

        const fileSize = this.hasFileSize(fp) && this.getFileSize(fp);
        const fileSizeStr = fileSize && filesizeUitl(fileSize);

        const avgSize = this.getPageAvgSize(fp);
        const avgSizeStr = avgSize > 0 && filesizeUitl(avgSize);

        let zipItem;
        let thumbnailurl = this.getThumbnailUrl(fp);

        if (this.state.noThumbnail) {
            zipItem = (
            <Link target="_blank" to={toUrl} key={fp} className={""} >
                <ThumbnailPopup filePath={fp} url={thumbnailurl}>
                    {this.getOneLineListItem(<i className="fas fa-book"></i>, text, fp)}
                </ThumbnailPopup>
            </Link>)
        } else {

            const musicNum = this.getMusicNum(fp);
            const isImgFolder = this.isImgFolder(fp);
            const hasMusic = musicNum > 0;
            const pageNum = this.getPageNum(fp);

            const fileInfoRowCn = classNames("file-info-row", {
                "less-padding": hasMusic
            })

            const thumbnailCn = classNames("file-cell-thumbnail", {
                "as-folder-thumbnail": isImgFolder
            });

            let imgDiv = <LoadingImage
                onlyUseURL={isImgFolder}
                isThumbnail
                className={thumbnailCn}
                title={this.getTooltipStr(fp)} 
                fileName={fp}
                url={thumbnailurl}
                musicNum={musicNum}
                onReceiveUrl={url => {
                    // TODO
                    // this.thumbnails[fp] = url;
                    // this.allfileInfos[fp].thumbnailFilePath = url;
                }}
            />;

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
        }

        return zipItem;
    }


    renderFileList(filteredFiles, filteredVideos) {
        const { sortOrder, isSortAsc , showFolderThumbnail } = this.state;
        let dirs = this.dirs;
        let videos = filteredVideos;
        let files = filteredFiles;

        
        try {
            files = this.sortFiles(files, sortOrder, isSortAsc);
        } catch (e) {
            console.error(e);
        }

        const isEmpty = [dirs, files, videos, this.musicFiles, this.imageFiles].every(_.isEmpty);
        if (isEmpty) {
            if (!this.res) {
                return (<CenterSpinner text={this.getTextFromQuery()} />);
            } else {
                const str = this.getMode() === MODE_EXPLORER ? "This folder is empty" : "Empty Result";
                return (
                    <div>
                        {this.renderFilterMenu()}
                        <div className="one-book-nothing-available">
                            <div className="alert alert-secondary" role="alert">{str}</div>
                        </div>
                    </div>);
            }
        }

        let dirItems;
        if (showFolderThumbnail) {
            dirItems = dirs.map((item) => {
                const toUrl = clientUtil.getExplorerLink(item);
                const text = getBaseName(item);

                // TODO
                let thumbnailurl = getFileUrl(this.dirThumbnailMap[item]);
                const thumbnailCn = classNames("file-cell-thumbnail", "as-folder-thumbnail");

                let imgDiv = <LoadingImage
                    onlyUseURL={true}
                    isThumbnail
                    className={thumbnailCn}
                    title={item} fileName={item}
                    url={thumbnailurl}
                />;

                return (
                    <div key={item} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
                        <div className="file-cell">
                            <Link to={toUrl} key={item} className={"file-cell-inner"}>
                                <FileCellTitle str={text} />
                                <div className="folder-effect"> {imgDiv} </div>
                            </Link>
                        </div>
                    </div>);
            });
        } else {
            dirItems = dirs.map((item) => {
                const toUrl = clientUtil.getExplorerLink(item);
                const text = getBaseName(item);
                const result = this.getOneLineListItem(<i className="far fa-folder"></i>, text, item);
                return (
                    <ThumbnailPopup filePath={item} key={item}>
                        <Link to={toUrl}>{result}</Link>
                    </ThumbnailPopup>
                );
            });
        }

        // TODO 实际显示20个，但会去loop全部
        const musicItems = this.musicFiles.map((item) => {
            const toUrl = clientUtil.getOneBookLink(getDir(item));
            const text = getBaseName(item);
            const result = this.getOneLineListItem(<i className="fas fa-volume-up"></i>, text, item);
            return <Link target="_blank" to={toUrl} key={item}>{result}</Link>;
        });

        const imageItems = this.imageFiles.map((item, ii) => {
            const toUrl = clientUtil.getOneBookLink(getDir(item));
            const text = getBaseName(item);
            const result = this.getOneLineListItem(<i className="fas fa-images"></i>, text, item);
            return <Link target="_blank" to={toUrl} key={item}>{result}</Link>;
        });

        //seperate av from others
        const groupByVideoType = _.groupBy(videos, item => {
            const text = getBaseName(item);
            const temp = parse(item);

            if (util.isAv(text)) {
                return "av"
            } else if (temp && temp.dateTag) {
                return "_date_";
            } else {
                return "etc";
            }
        }) || {};

        //todo av-color
        const videoDivGroup = _.keys(groupByVideoType).map((key, ii) => {
            let group = groupByVideoType[key];
            group.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            const videoItems = group.map((item) => {
                const toUrl = clientUtil.getVideoPlayerLink(item);
                const text = getBaseName(item);
                const result = this.getOneLineListItem(<i className="far fa-file-video"></i>, text, item);
                // 会卡顿，弃用video preview
                // return (
                // <ThumbnailPopup filePath={item} key={item}>
                //     <Link target="_blank" to={toUrl} >{result}</Link>
                // </ThumbnailPopup>
                // );
                return (
                        <Link target="_blank" to={toUrl} key={item}>{result}</Link>
                );
            });
            return <ItemsContainer key={key} className="video-list" items={videoItems} />
        })

        

        //better tooltip to show file size 
        //and tag
        files = this.getFileInPage(files);

        let zipfileItems;
        if (sortOrder === BY_FOLDER || sortOrder === BY_FOLDER && 
            (this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH)) {
            const byDir = _.groupBy(files, getDir);
            let fDirs = _.keys(byDir);
            // 文件夹根据所拥有文件件的时间来排序
            fDirs = _.sortBy(fDirs, dirPath => {
                const files = byDir[dirPath];
                const times = files.map(fp =>  this.getMtime(fp)).filter(e => !!e);
                const avgTime = util.getAverage(times);
                return avgTime || 0;
            });

            if (!this.state.isSortAsc) {
                fDirs.reverse();
            }

            zipfileItems = [];
            fDirs.map((dirPath, ii) => {
                const folderGroup = byDir[dirPath];
                const extraDiv = (<div className="extra-div" >{`Zip: ${folderGroup.length}`} </div>);
                const seperator = (<div className="col-12" key={dirPath + "---seperator"}>
                    <Breadcrumb sep={this.context.file_path_sep}
                        server_os={this.context.server_os}
                        path={dirPath}
                        className={ii > 0 ? "not-first-breadcrumb folder-seperator" : "folder-seperator"} 
                        extraDiv={extraDiv}
                    />
                    
                </div>);
                zipfileItems.push(seperator)
                const zipGroup = folderGroup.map(fp => this.renderSingleZipItem(fp));
                zipfileItems.push(...zipGroup);
            })
        } else {
            //! !todo if the file is already an image file
            zipfileItems = files.map(fp => this.renderSingleZipItem(fp));
        }

        const rowCn = this.state.noThumbnail ? "file-list" : "row";

        return (
            <div className={"explorer-container"}>
                {!showFolderThumbnail && <ItemsContainer items={dirItems} neverCollapse={this.getMode() === MODE_EXPLORER} />}
                {showFolderThumbnail &&
                    <div className={"file-grid container"}>
                        <div className={"row"}>
                            {dirItems}
                        </div>
                    </div>
                }
                <ItemsContainer items={musicItems} />
                <ItemsContainer items={imageItems} />
                {videoDivGroup}
                {this.renderPagination(filteredFiles, filteredVideos)}
                {this.renderFilterMenu()}
                {zipfileItems.length > 0 && this.renderSortHeader()}
                <div className={"file-grid container"}>
                    <div className={rowCn}>
                        {zipfileItems}
                    </div>
                </div>
            </div>
        );
    }

    isFailedLoading() {
        return this.res && this.res.isFailed();
    }

    toggleRecursively() {
        this.resetParam();
        this.setStateAndSetHash({
            pageIndex: 1,
            isRecursive: !this.state.isRecursive
        }, () => {
            (async () => {
                let res = await Sender.postWithPromise('/api/lsDir', { dir: this.getTextFromQuery(), isRecursive: this.state.isRecursive });
                this.handleLsDirRes(res);
            })();
        })
    }

    toggleThumbNail() {
        const prev = this.state.noThumbnail;
        const next = !prev;

        this.setStateAndSetHash({
            noThumbnail: next
        })
    }

    async toggleFolderThumbNail() {
        const next = !this.state.showFolderThumbnail;

        this.setStateAndSetHash({
            showFolderThumbnail: next
        })

        if(next && !this.hasCalled_getThumbnailForFolders){
            this.requestThumbnailForFolder();
        }
    }

    async requestThumbnailForFolder(){
        // TODO
        Sender.post("/api/getThumbnailForFolders", { dirs: this.dirs }, res => {
            if (!res.isFailed()) {
                this.dirThumbnailMap =  res.json.dirThumbnails;
                this.hasCalled_getThumbnailForFolders = true;
                this.askRerender();
            }
        });
    }

    askRerender(){
        this.setState({
            rerenderTick: !this.state.rerenderTick
        })
    }

    toggleShowVideo() {
        this.setStateAndSetHash({
            showVideo: !this.state.showVideo
        })
    }

    renderToggleThumbNailButton() {
        const text2 = this.state.noThumbnail ? "File Thumbnail" : "File Name Only";
        return (
            <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={this.toggleThumbNail.bind(this)}>
                <span className="fas fa-book" /> <span>{text2} </span>
            </span>
        );
    }

    renderToggleFolferThumbNailButton() {
        const text2 = this.state.showFolderThumbnail ? "Folder Name Only" : "Folder Thumbnail";
        return (
            <span key="folder-thumbnail-button" className="thumbnail-button exp-top-button" onClick={this.toggleFolderThumbNail.bind(this)}>
                <span className="fas fa-book" /> <span>{text2} </span>
            </span>
        );
    }

    renderShowVideoButton() {
        const text2 = this.state.showVideo ? "Hide video" : "Show video";
        return (
            <span className="show-video-button exp-top-button" onClick={this.toggleShowVideo.bind(this)}>
                <span className="fas fa-video" />
                <span> {text2} </span>
            </span>
        );
    }

    renderLevelButton() {
        const text = this.state.isRecursive ? "Show only one level" : "Show subfolder's files";
        return (
            <span className="recursive-button exp-top-button" onClick={this.toggleRecursively.bind(this)}>
                <span className="fas fa-glasses" />
                <span> {text} </span>
            </span>
        );
    }

    renderToggleMenuButton() {
        const text = "Toggle Menu"
        return (
            <span key="toggle-side-menu-button" className="toggle-side-menu-button exp-top-button" onClick={this.toggleSideMenu.bind(this)}>
                <span className="fas fa-ellipsis-h" />
                <span> {text} </span>
            </span>
        );
    }

    renderChartButton() {
        const table = {}
        table[MODE_AUTHOR] = "/chart/?a=";
        table[MODE_EXPLORER] = "/chart/?p=";
        table[MODE_SEARCH] = "/chart/?s=";
        table[MODE_TAG] = "/chart/?t=";
        let link = table[this.getMode()] + this.getTextFromQuery();
        if (this.state.isRecursive) {
            link += "&isRecursive=true"
        }

        return (<Link target="_blank" className="exp-top-button" to={link}>
            <span className="fas fa-chart-line" />
            <span> Chart </span>
        </Link>)
    }

    renderPregenerateButton() {
        if (this.getMode() === MODE_EXPLORER) {
            const text = "Generate thumbnail"
            return (
                <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={() => AdminUtil.askPregenerate(this.getPathFromQuery(), true)}>
                    <span className="fas fa-tools" />
                    <span> {text} </span>
                </span>
            );
        }
    }

    renderFileCount(filteredFiles, filteredVideos) {
        const totalZipSize = this.countAllFileSize(filteredFiles);
        const totalVideoSize = this.countAllFileSize(filteredVideos);
        const totalSize = totalZipSize + totalVideoSize;
        const title = `${filesizeUitl(totalZipSize)} zips and ${filesizeUitl(totalVideoSize)} videos`
        const totalPageNum = this.countAllFilePageNum(filteredFiles);
        return (
            <div className="row">
                <div className="col-12 file-count-row">
                    <div className="file-count">{"Zip: " + filteredFiles.length} </div>
                    <div className="file-count">{"Page: " + totalPageNum} </div>
                    <div className="file-count">{"Video: " + filteredVideos.length} </div>
                    <div className="file-count">{"Music: " + this.musicFiles.length} </div>
                    <div className="file-count">{"Image: " + this.imageFiles.length} </div>
                    <div className="file-count">{"Folder: " + this.dirs.length} </div>
                    <div className="file-count" title={title}>{"Total: " + filesizeUitl(totalSize)} </div>
                </div>
            </div>
        );
    }

    getBookModeLink() {
        const onebookUrl = clientUtil.getOneBookLink(this.getTextFromQuery());
        return (
            <Link target="_blank" className="exp-top-button"  to={onebookUrl} >
                <span className="fas fa-book-reader" />
                <span>Open in Book Mode </span>
            </Link>
        )
    }

    getExplorerToolbar(filteredFiles, filteredVideos) {
        const mode = this.getMode();


        const isExplorer = mode === MODE_EXPLORER && this.getPathFromQuery();
        const isTag = mode === MODE_TAG;
        const isAuthor = mode == MODE_AUTHOR;
        const url = clientUtil.getSearhLink(this.getTextFromQuery());

        const isInfoMode = !this.isLackInfoMode();

        // 没加入config-path,递归显示，文件搜索都不行。因为文件没被监听，不存在数据库
        const warning = this.isLackInfoMode() && (
            <NoScanAlertArea filePath={this.getTextFromQuery()}></NoScanAlertArea>
        );

        let topButtons = (
            <div className="top-button-gropus row">
                <div className="col-6 col-md-4"> {this.renderToggleFolferThumbNailButton()} </div>
                <div className="col-6 col-md-4"> {this.renderToggleThumbNailButton()} </div>
                <div className="col-6 col-md-4"> {this.renderShowVideoButton()} </div>

                {isInfoMode && <div className="col-6 col-md-4"> {this.renderChartButton()} </div>}
                {isExplorer && isInfoMode &&
                    <div className="col-6 col-md-4"> {this.renderLevelButton()} </div>}
                {isExplorer &&
                    <div className="col-6 col-md-4"> {this.renderPregenerateButton()} </div>}
                {
                    (isTag || isAuthor) &&
                    <div className="col-6 col-md-4">
                        <Link  target="_blank" className="exp-top-button" to={url} >
                            <span className="fab fa-searchengin" />
                            <span>Search by Text </span>
                        </Link>
                    </div>
                }
                {isExplorer && <div className="col-6 col-md-4"> {this.getBookModeLink()} </div>}
                <div className="col-6 col-md-4 " > {this.renderToggleMenuButton()} </div>
            </div>);

        const breadcrumb = isExplorer && (<div className="row">
            <Breadcrumb sep={this.context.file_path_sep}
                server_os={this.context.server_os}
                path={this.getPathFromQuery()} className="col-12" />
        </div>);

        return (<div className="container explorer-top-bar-container">
            {breadcrumb}
            {warning}
            {this.renderFileCount(filteredFiles, filteredVideos)}
            {topButtons}
        </div>);
    }

    getTitle() {
        const mode = this.getMode();

        if (this.tag && mode === MODE_TAG) {
            return "Tag: " + this.tag;
        } else if (this.author && mode === MODE_AUTHOR) {
            return "Author: " + this.author;
        } else if (mode === MODE_SEARCH) {
            return "Search Result: " + this.getTextFromQuery();
        }
    }

    getLinkToEhentai() {
        let searchable = this.tag || this.author;
        const isSearchMode = this.getMode() === MODE_SEARCH;
        if (isSearchMode) {
            searchable = this.getTextFromQuery();
        }

        if (searchable) {
            const link = "https://exhentai.org/?f_search=" + searchable;
            const title = "Search '" + searchable + "' in Exhentai";

            let btn;
            if (this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH) {
                btn = [this.renderToggleThumbNailButton(), this.renderToggleFolferThumbNailButton(), this.renderToggleMenuButton()];
            }

            return (<center className={"location-title"}>
                <a className="explorer-external-link" target="_blank" href={link} title={title}>{this.getTitle()} </a>
                <ClickAndCopyDiv text={searchable} />
            </center>);
        }
    }

    toggleItemNum() {
        let nv = this.state.perPageItemNum + 12;
        nv = Math.min(nv, 108);
        this.setStateAndSetHash({
            perPageItemNum: nv,
            pageIndex: Math.min(Math.ceil(this.getFilteredFiles().length / nv), this.state.pageIndex)
        })
    }

    renderPagination(filteredFiles, filteredVideos) {
        const fileLength = filteredFiles.length;
        return (<div className="pagination-container">
            <Pagination ref={ref => this.pagination = ref}
                currentPage={this.state.pageIndex}
                itemPerPage={this.getNumPerPage()}
                totalItemNum={fileLength}
                onChange={this.handlePageChange.bind(this)}
                onExtraButtonClick={this.toggleItemNum.bind(this)}
                linkFunc={clientUtil.linkFunc}
            /></div>);
    }

    setWebTitle() {
        document.title = this.getTextFromQuery() || "ShiguReader";
    }

    onSortChange(sortOrder, isSortAsc) {
        this.setStateAndSetHash({ sortOrder, isSortAsc })
    }

    toggleSideMenu() {
        this.setState({ anchorSideMenu: !this.state.anchorSideMenu })
    }

    setFilterText(text) {
        this.setStateAndSetHash({ filterText: text, pageIndex: 1 });
    }

    setFilterType(text) {
        this.setStateAndSetHash({ filterType: text, pageIndex: 1 });
    }

    toggleFilter(key) {
        let filterArr = this.state.filterArr.slice();
        const index = filterArr.indexOf(key)

        if (index > -1) {
            filterArr.splice(index, 1)
        } else {
            filterArr.push(key);
        }

        // console.log(filterArr)
        this.setStateAndSetHash({
            filterArr,
            pageIndex: 1
        });
    }

    isOn(key) {
        return this.state.filterArr.includes(key);
    }

    renderSideMenu(filteredFiles, filteredVideos) {
        if (!this.state.anchorSideMenu) {
            return;
        }

        const tag2Freq = {};
        const type2Freq = {};

        filteredFiles.forEach(e => {
            const result = parse(e);
            let tags = [];

            if (result) {
                if (result.tags) {
                    tags = result.tags;
                }

                if (result.type) {
                    type2Freq[result.type] = type2Freq[result.type] || 0;
                    type2Freq[result.type]++;
                }
            }

            tags.forEach(t => {
                if (t.length > 1) {
                    tag2Freq[t] = tag2Freq[t] || 0;
                    tag2Freq[t]++;
                }
            })
        });

        let tags = _.keys(tag2Freq);
        tags.sort((a, b) => {
            return tag2Freq[b] - tag2Freq[a];
        })

        let types = _.keys(type2Freq);
        types.sort((a, b) => {
            return type2Freq[b] - type2Freq[a];
        })

        const tagInfos = tags.map(t => {
            return (<div className="side-menu-single-tag col-3" onClick={() => this.setFilterText(t)}
                key={t}>
                {t}<span>({tag2Freq[t]})</span>
            </div>);
        });

        const typeInfos = types.map(t => {
            return (<div className="side-menu-single-tag col-3 type-tag" onClick={() => this.setFilterType(t)}
                key={t}>
                {t}<span>({type2Freq[t]})</span>
            </div>);
        });


        let showAll;

        const { filterText, filterType } = this.state;

        //!!duplicate code here. need to fix
        if ((_.isString(filterText) && filterText) ||
            (_.isString(filterType) && filterType)) {
            // tagInfos.unshift(showAll);

            showAll = (
                <div className="side-menu-single-tag col-3" onClick={() => {
                    this.setFilterText("");
                    this.setFilterType("")
                }}
                    key={"side-menu-single-tag-all"}>
                    Back to All
                </div>);
        }
        const tagContainer = (<div className="exp-tag-container row">
            {showAll}
            {typeInfos}
            {tagInfos}
        </div>);

        const cn = classNames("side-menu container", {
            anchorSideMenu: this.state.anchorSideMenu
        });

        return (<div className={cn}>
            <div className="side-menu-radio-title"> Special Filter </div>
            <div className="row info-row">
                <div className="col-3">{`filterText: ${filterText || "-"}`} </div>
                <div className="col-3">{`filterType: ${filterType || "-"}`} </div>
            </div>
            {tagContainer}
        </div>)
    }

    renderSortHeader() {
        let sortOptions = ClientConstant.SORT_OPTIONS.slice();

        if (this.getMode() !== MODE_EXPLORER) {
            sortOptions.push(BY_FOLDER);
        }

        return (<div className="sort-header-container container">
            <SortHeader sortOptions={sortOptions} selected={this.state.sortOrder} 
                        isSortAsc={this.state.isSortAsc}
                        onChange={this.onSortChange.bind(this)} />
        </div>);
    }

    renderFilterMenu() {
        //no one pay me, I am not going to improve the ui
        let checkbox;
        if (this.state.authorInfo) {
            checkbox = (<Checkbox
                onChange={this.toggleFilter.bind(this, FILTER_GOOD_AUTHOR)}
                checked={this.isOn(FILTER_GOOD_AUTHOR)}
                title={`need to found more than ${GOOD_STANDARD} times in good folder`}>
                By Good Count
                </Checkbox>);
        }

        const st2 = `Image > ${userConfig.oversized_image_size} MB`;
        let checkbox2 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_OVERSIZE)} checked={this.isOn(FILTER_OVERSIZE)}>
            {st2}
        </Checkbox>);

        const st3 = `First Time Author`;
        let checkbox3 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_FIRST_TIME_AUTHOR)} checked={this.isOn(FILTER_FIRST_TIME_AUTHOR)}>
            {st3}
        </Checkbox>);

        const st4 = `Has Music`;
        let checkbox4 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_HAS_MUSIC)} checked={this.isOn(FILTER_HAS_MUSIC)}>
            {st4}
        </Checkbox>);

        const st45 = `Has Video`;
        let checkbox45 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_HAS_VIDEO)} checked={this.isOn(FILTER_HAS_VIDEO)}>
            {st45}
        </Checkbox>);

        const st5 = `Only Image Folder`;
        let checkbox5 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_IMG_FOLDER)} checked={this.isOn(FILTER_IMG_FOLDER)}>
            {st5}
        </Checkbox>);
        return (
            <div className="aji-checkbox-container container">
                {/* {checkbox} */}
                {/* {checkbox2} */}
                {checkbox3}
                {checkbox4}
                {checkbox45}
                {checkbox5}
            </div>);
    }

    render() {
        this.setWebTitle();
        // this.time = this.time|| 1;
        // console.log(this.time);
        // this.time++;

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res} />;
        }

        const filteredFiles = this.getFilteredFiles();
        const filteredVideos = this.getFilteredVideos();

        const cn = classNames("explorer-container-out", this.getMode().replace(" ", "_"));

        return (<div className={cn} >
            {this.getLinkToEhentai()}
            {this.getExplorerToolbar(filteredFiles, filteredVideos)}
            {this.renderSideMenu(filteredFiles, filteredVideos)}
            {this.renderFileList(filteredFiles, filteredVideos)}
            {this.renderPagination(filteredFiles, filteredVideos)}
        </div>
        );
    }
}

ExplorerPage.contextType = GlobalContext;