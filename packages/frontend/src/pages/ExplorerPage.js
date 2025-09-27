// @flow
import React, { Component } from 'react';
import _ from "underscore";
import '@styles/Explorer.scss';
import LoadingImage from '@components/LoadingImage';
import { listDirectory } from '@api/folder';
import { searchFiles } from '@api/search';
import { getGoodAuthorNames } from '@api/info';
import { getFolderListThumbnails } from '@api/thumbnail';
import { Link } from 'react-router-dom';

const userConfig = require('@config/user-config');
import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
const util = require("@common/util");
const queryString = require('query-string');
import Pagination from '@components/common/Pagination';
import ItemsContainer from '@components/common/ItemsContainer';
import SortHeader from '@components/common/SortHeader';
import Breadcrumb from '@components/common/Breadcrumb';
import FileCellTitle from '@components/common/FileCellTitle';
import Checkbox from '@components/common/Checkbox';
import ThumbnailPopup from '@components/common/ThumbnailPopup';
import { getFileUrl } from '@utils/clientUtil';
const nameParser = require('@name-parser');
const classNames = require('classnames');
const Constant = require("@common/constant");
const clientUtil = require("@utils/clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil;
const { isVideo, isCompress, isImage, isMusic } = util;
const AdminUtil = require("@utils/AdminUtil");
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';

import { GlobalContext } from '@context/GlobalContext';
import { NoScanAlertArea, FileCountPanel, getOneLineListItem,
         LinkToEHentai, SimpleFileListPanel, SingleZipItem, FileGroupZipPanel } from '@components/ExplorerPageUI';

import * as ExplorerUtil from "@utils/ExplorerUtil";


const ClientConstant = require("@utils/ClientConstant");
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


const FILTER_HAS_MUSIC = "FILTER_HAS_MUSIC";
const FILTER_HAS_VIDEO = "FILTER_HAS_VIDEO";
const FILTER_IMG_FOLDER = "FILTER_IMG_FOLDER";





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

const DEFAULT_MAX_PAGE = 300;

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);

        this.metaInfo = [
            { key: "pageIndex", type: "int", defVal: 1 },
            { key: "isRecursive", type: "boolean", defVal: false },
            { key: "sortOrder", type: "str", defVal: BY_TIME },
            { key: "isSortAsc", type: "boolean", defVal: false },
            { key: "showVideo", type: "boolean", defVal: true },
            { key: "showFolderThumbnail", type: "boolean", defVal: false },
            { key: "filterArr", type: "arr" },
            { key: "pageNumRange", type: "arr", defVal:[0, DEFAULT_MAX_PAGE]},  // 默认全部范围
            { key: "filterText", type: "str" },
            { key: "filterType", type: "str" },
            { key: "noThumbnail", type: "boolean", defVal: false },
        ];

        this.state = this.getInitState();
 
        this.resetParam();
    }

    getNumPerPage() {
        return (this.state.noThumbnail || this.state.sortOrder === BY_FOLDER) ?
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
        const newState = { ...this.state, ...state };
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

    static getDerivedStateFromProps(nextProps, prevState) {
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
                res = await listDirectory({ dir: this.getTextFromQuery(), isRecursive: this.state.isRecursive });
                await this.handleLsDirRes(res);
            }
        } else {
            const hash = this.getTextFromQuery();
            if (hash && this.loadedHash !== hash) {
                if (this.getMode() === MODE_TAG) {
                    res = await searchFiles({ text: this.getTextFromQuery(), mode: this.getMode() })
                } else if (this.getMode() === MODE_AUTHOR) {
                    res = await searchFiles({ text: this.getTextFromQuery(), mode: this.getMode() })
                } else if (this.getMode() === MODE_SEARCH) {
                    res = await searchFiles({ text: this.getSearchTextFromQuery(), mode: this.getMode() })
                }
            }
            await this.handleLsDirRes(res);
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


    async handleLsDirRes(res) {
        if (!res.isFailed()) {
            let {
                dirs = [],
                mode,
                tag = "",
                author = "",
                fileInfos = {},
                imgFolderInfo = {},
                fileHistory = [],
                nameParseCache = {}
            } = res.json;

            // 马上叫server准备下一个信息
            getGoodAuthorNames().then(res => {
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
                this.fileNameToHistory[fileName] = { time, count };
            })

            if (this.videoFiles.length > 0 && !this.state.showVideo) {
                this.setStateAndSetHash({
                    showVideo: true
                });
            }

            // 找出最大页数
            let _maxPage = 10;
            files.forEach(e => {
                const count = this.getPageNum(e);
                _maxPage = Math.max(_maxPage, count);
            })
            this.minPageNum = 0;
            this.maxPageNum = _maxPage;
      

            //check pageindex
            const availableFiles = this.getFileInPage(this.getFilteredFiles());

            if (availableFiles.length === 0) {
                //this will set state
                this.handlePageChange(1);
            } else {
                this.askRerender();
            }

            this.hasCalled_getThumbnailForFolders = false;
            if (this.state.showFolderThumbnail) {
                this.requestThumbnailForFolder();
            }
        } else {
            this.res = res;
            this.askRerender();
        }
    }

    decorate_allfileInfos() {
        // this.allfileInfos
        for (const fp in this.allfileInfos) {
            if (!this.allfileInfos.hasOwnProperty(fp)) {
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

    calculateAvgPageSize(fp) {
        //may not be reliable
        const pageNum = this.getPageNum(fp);
        if (pageNum === 0) {
            return 0;
        }

        const totalImgSize = this.getTotalImgSize(fp);
        const videoNum = this.getVideoNum(fp);

        return util.calcAvgImgSize({ pageNum, totalImgSize, videoNum });
    }

    async handleKeyDown(event) {
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
        } else if (key == "r") {
            this.loadedHash = ""; // 感觉这玩意是个错误design
            await this.askServer();
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

    getMtime(fp) {
        return this.allfileInfos[fp]?.mtimeMs || 0;
    }

    /** get tag time */
    getTTime(fp) {
        const fn = getBaseName(fp);
        let tTime = nameParser.getDateFromParse(fn);
        tTime = tTime && tTime.getTime();
        return tTime || 0;
    }

    getReadCount(fp) {
        const fn = getBaseName(fp);
        const count = _parseInt(this.fileNameToHistory[fn]?.count);
        return count || 0;
    }

    getLastReadTime(fp) {
        const fn = getBaseName(fp);
        const rTime = _parseInt(this.fileNameToHistory[fn]?.time);
        return rTime || 0;
    }

    getFilteredFiles() {
        let files = [...this.compressFiles, ...(_.keys(this.imgFolderInfo))];

        const { pageNumRange } = this.state;

        const maxPage =  pageNumRange[1] >= this.getMaxPageForSlider()? Infinity:  pageNumRange[1];
        files = files.filter(e => {
            const count = this.getPageNum(e);
            if (_.isNull(count) || count === 0) {
                return true;
            } else if (count >= pageNumRange[0] && count <= maxPage ) {
                return true;
            }
        })

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

    

    getScore(fp) {
        let score = this.getAuthorCountForFP(fp).score || 0;
        return score;
    }

    getAuthorCountForFP(fp) {
        const temp = parse(fp);
        if (temp && temp.authors) {
            // todo multiple-author
            return clientUtil.getAuthorCount(this.state.authorInfo, temp.authors[0]) || {};
        } else {
            return {};
        }
    }



    getTooltipStr(fp) {
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

    isImgFolder(fp) {
        return !!this.imgFolderInfo[fp];
    }

    getThumbnailUrl(fp) {
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
        const toUrl = clientUtil.getBookReadLink(fp);

        let zipItem;
        let thumbnailurl = this.getThumbnailUrl(fp);

        if (this.state.noThumbnail) {
            zipItem = (
                <Link target="_blank" to={toUrl} key={fp} className={""} >
                    <ThumbnailPopup filePath={fp} url={thumbnailurl}>
                        {getOneLineListItem(<i className="fas fa-book"></i>, text, fp, this)}
                    </ThumbnailPopup>
                </Link>)
        } else {

            zipItem = <SingleZipItem key={fp} filePath={fp}  info={this} />
        }
        return zipItem;
    }


    renderFileList(filteredFiles, filteredVideos) {
        const { sortOrder, isSortAsc, showFolderThumbnail } = this.state;
        let dirs = this.dirs;
        let videos = filteredVideos;
        let files = filteredFiles;

        try {
            files = ExplorerUtil.sortFiles(this, files, sortOrder, isSortAsc);
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
                        {this.renderFilterControls()}
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

                let imgDiv = (
                <LoadingImage
                    className={thumbnailCn}
                    title={item} 
                    fileName={item}
                    url={thumbnailurl}
                    mode={"folder"}
                />);

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
                const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item, this);
                return (
                    <ThumbnailPopup filePath={item} key={item}>
                        <Link to={toUrl}>{result}</Link>
                    </ThumbnailPopup>
                );
            });
        }

      

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
                const result = getOneLineListItem(<i className="far fa-file-video"></i>, text, item, this);
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
    
            zipfileItems = <FileGroupZipPanel files={files} isSortAsc={this.state.isSortAsc} info={this} />
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

                <SimpleFileListPanel musicFiles={this.musicFiles} imageFiles={this.imageFiles} info={this} />

                {videoDivGroup}
                {this.renderPagination(filteredFiles, filteredVideos)}
                {this.renderFilterControls()}
                {zipfileItems.length > 0 && this.renderSortHeader()}
                <div className={"file-grid container"}>
                    <div className={rowCn}>
                        {zipfileItems}
                    </div>
                </div>
            </div>
        );
    }

    getMaxPageForSlider(){
       return Math.min(DEFAULT_MAX_PAGE, this.maxPageNum);
    }

    renderPageRangeSilder() {
        const { pageNumRange } = this.state;
        const maxForSilder = this.getMaxPageForSlider();
        const righttext = pageNumRange[1] >= maxForSilder? `${this.maxPageNum}/${this.maxPageNum}` : `${pageNumRange[1]}/${this.maxPageNum}`

        // 本质就range slider的max不超过300的，超过和到达的时候有额外逻辑
        return (
            <div className='page-number-range-slider-wrapper'>
                <div className='small-text-title no-wrap' >Page Range:</div>
                <div className='small-text-title'>{pageNumRange[0]} </div>
                <RangeSlider className="page-number-range-slider" 
                min={this.minPageNum} max={maxForSilder} step={1} 
                value={pageNumRange} 
                onInput={(range) => {
                    console.log(range);
                    if(range[0] === pageNumRange[0] && range[1] === pageNumRange[1]){
                        //
                    }else{
                        this.setStateAndSetHash({ pageNumRange: range })
                    }
                }} />
                <div className='small-text-title'>{righttext}</div>
            </div>);
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
                let res = await listDirectory({ dir: this.getTextFromQuery(), isRecursive: this.state.isRecursive });
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

        if (next && !this.hasCalled_getThumbnailForFolders) {
            this.requestThumbnailForFolder();
        }
    }

    async requestThumbnailForFolder() {
        const res = await getFolderListThumbnails(this.dirs);
        if (!res.isFailed()) {
            this.dirThumbnailMap = res.json.dirThumbnails;
            this.hasCalled_getThumbnailForFolders = true;
            this.askRerender();
        }
    }

    askRerender() {
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
        const text2 = this.state.showVideo ? "Hide Video" : "Show Video";
        return (
            <span className="show-video-button exp-top-button" onClick={this.toggleShowVideo.bind(this)}>
                <span className="fas fa-video" />
                <span> {text2} </span>
            </span>
        );
    }

    renderLevelButton() {
        const text = this.state.isRecursive ? "Show Only One Level" : "Show Files in Subfolders";
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
            const text = "Generate Thumbnail"
            return (
                <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={() => AdminUtil.askPregenerate(this.getPathFromQuery(), true)}>
                    <span className="fas fa-tools" />
                    <span> {text} </span>
                </span>
            );
        }
    }

 

    getBookModeLink() {
        const bookReadUrl = clientUtil.getBookReadLink(this.getTextFromQuery());
        return (
            <Link target="_blank" className="exp-top-button" to={bookReadUrl} >
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
                        <Link target="_blank" className="exp-top-button" to={url} >
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
            <FileCountPanel filteredFiles={filteredFiles} filteredVideos={filteredVideos} info={this} />
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
            return <LinkToEHentai searchable={searchable} text={this.getTitle()} />
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
            <div className="side-menu-radio-title"> Special Filters </div>
            <div className="row info-row">
                <div className="col-3">{`Filter Text: ${filterText || "-"}`} </div>
                <div className="col-3">{`Filter Type: ${filterType || "-"}`} </div>
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

    renderCheckboxPanel() {
        // Define a list of filters with their descriptions
        const filters = [
            { id: 'FILTER_HAS_MUSIC', label: 'Has Music' },
            { id: 'FILTER_HAS_VIDEO', label: 'Has Video' },
            { id: 'FILTER_IMG_FOLDER', label: 'Image Folders Only' }
        ];

        // Map over the filters array to create checkbox components
        const checkboxes = filters.map(filter => (
            <Checkbox
                key={filter.id}
                onChange={this.toggleFilter.bind(this, filter.id)}
                checked={this.isOn(filter.id)}
            >
                {filter.label}
            </Checkbox>
        ));

        // Return the container with all checkboxes
        return (
            <div className="aji-checkbox-container">
                {checkboxes}
            </div>
        );
    }

    renderFilterControls() {
        return (
            <div className="explorer-filter-controls container">
                {this.renderPageRangeSilder()}
                {this.renderCheckboxPanel()}
            </div>
        );
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