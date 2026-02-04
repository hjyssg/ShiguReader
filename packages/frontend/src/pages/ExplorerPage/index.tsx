
import React, { Component, ReactNode } from 'react';
import _ from "underscore";
import './ExplorerPage.scss';
import LoadingImage from '@components/LoadingImage';
import { listDirectory } from '@api/folder';
import { searchFiles } from '@api/search';
import { getGoodAuthorNames } from '@api/info';
import { getFolderListThumbnails } from '@api/thumbnail';
import { Link } from 'react-router-dom';

import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import * as util from "@common/util";
import queryString from 'query-string';
import Pagination from '@components/common/Pagination';
import ItemsContainer from '@components/common/ItemsContainer';
import SortHeader from '@components/common/SortHeader';
import Breadcrumb from '@components/common/Breadcrumb';
import FileCellTitle from '@components/common/FileCellTitle';
import Checkbox from '@components/common/Checkbox';
import FilterPanel from '@components/common/FilterPanel';
import ThumbnailPopup from '@components/common/ThumbnailPopup';
import { getFileUrl } from '@utils/clientUtil';
import * as nameParser from '@name-parser';
import classNames from 'classnames';
import * as Constant from "@common/constant";
import * as clientUtil from "@utils/clientUtil";
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil as any;
const { isVideo, isCompress, isImage, isMusic } = util;
import { askPregenerate } from "@utils/ThumbnailGenerationUtil";
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';

import { GlobalContext, GlobalContextType } from '@context/GlobalContext';
import {
    NoScanAlertArea, FileCountPanel, getOneLineListItem,
    LinkToEHentai, SimpleFileListPanel, SingleZipItem, FileGroupZipPanel
} from '@components/ExplorerPageUI';

import * as ExplorerUtil from "@utils/ExplorerUtil";
import * as ClientConstant from "@utils/ClientConstant";

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
    BY_RANDOM } = ClientConstant as any;

const { MODE_TAG,
    MODE_AUTHOR,
    MODE_SEARCH,
    MODE_EXPLORER } = Constant as any;


const FILTER_HAS_MUSIC = "FILTER_HAS_MUSIC";
const FILTER_HAS_VIDEO = "FILTER_HAS_VIDEO";
const FILTER_IMG_FOLDER = "FILTER_IMG_FOLDER";
const UNTAGGED_TAG_LABEL = "etc";

function parse(str: string) {
    return (nameParser as any).parse(getBaseName(str));
}

function _parseInt(val: any) {
    if (_.isNumber(val)) {
        return val;
    } else {
        return parseInt(val);
    }
}

const DEFAULT_MAX_PAGE = 300;

class ExplorerPage extends Component<any, any> {
    metaInfo: any[];
    loadedHash: string = "";
    videoFiles: string[] = [];
    compressFiles: string[] = [];
    imageFiles: string[] = [];
    musicFiles: string[] = [];
    dirs: string[] = [];
    tag: string = "";
    author: string = "";
    fileInfos: any = {};
    imgFolderInfo: any = {};
    res: any = null;
    dirThumbnailMap: any = {};
    minPageNum: number = 0;
    maxPageNum: number = 0;
    mode: string = "";
    allfileInfos: any = {};
    fileNameToHistory: any = {};
    hasCalled_getThumbnailForFolders: boolean = false;
    pagination: any;
    _handleKeyDown: any;

    constructor(prop: any) {
        super(prop);

        this.metaInfo = [
            { key: "pageIndex", type: "int", defVal: 1 },
            { key: "isRecursive", type: "boolean", defVal: false },
            { key: "sortOrder", type: "str", defVal: BY_MTIME },
            { key: "isSortAsc", type: "boolean", defVal: false },
            { key: "showFolderThumbnail", type: "boolean", defVal: false },
            { key: "filterArr", type: "arr" },
            { key: "pageNumRange", type: "arr", defVal: [0, DEFAULT_MAX_PAGE] },  // 默认全部范围
            { key: "filterText", type: "str" },
            { key: "filterTags", type: "arr", defVal: [] },
            { key: "noThumbnail", type: "boolean", defVal: false },
        ];

        this.state = this.getInitState();

        this.resetParam();
    }

    getNumPerPage() {
        return (this.state.noThumbnail || this.state.sortOrder === BY_FOLDER) ?
            1000 : this.state.perPageItemNum;
    }

    getInitState(reset?: boolean) {
        const initState = clientUtil.getInitState(this.metaInfo, reset);
        return {
            perPageItemNum: getPerPageItemNumber(),
            ...initState
        }
    }

    setStateAndSetHash(state: any, callback?: () => void) {
        this.setState(state, callback);
        const newState = { ...this.state, ...state };
        clientUtil.saveStateToUrl(this.metaInfo, newState);
    }

    handlePageChange(index: number) {
        if ((window.event as any) && (window.event as any).ctrlKey) {
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

    getPathFromQuery(props?: any) {
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["p"] as string || "";
    }

    getSearchTextFromQuery(props?: any) {
        const _props = props || this.props;
        if (this.getMode(_props) === MODE_SEARCH) {
            let str = _props.location.search || _props.location.pathname;
            str = str.replace("/search/?", "")
            return queryString.parse(str)["s"] as string || "";
        }
        return "";
    }

    getAuthorFromQuery(props?: any) {
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["a"] as string || "";
    }

    getTagFromQuery(props?: any) {
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["t"] as string || "";
    }

    getTextFromQuery(props?: any) {
        const _props = props || this.props;
        return this.getTagFromQuery(_props) ||
            this.getAuthorFromQuery(_props) ||
            this.getSearchTextFromQuery(_props) ||
            this.getPathFromQuery(_props);
    }

    getMode(props?: any) {
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
        return "";
    }

    static getDerivedStateFromProps(nextProps: any, prevState: any) {
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
            if (res) {
                await this.handleLsDirRes(res);
            }
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

    componentDidUpdate(prevProps: any, prevState: any) {
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


    async handleLsDirRes(res: any) {
        if (res && !(res as any).isFailed()) {
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
                if (res && !(res as any).isFailed()) {
                    this.setState({
                        authorInfo: res.json.authorInfo,
                        tagInfo: res.json.tagInfo
                    })
                }
            });

            (nameParser as any).setLocalCache(nameParseCache);
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
            fileHistory.forEach((row: any) => {
                const { fileName, time, count } = row;
                this.fileNameToHistory[fileName] = { time, count };
            })

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

    calculateAvgPageSize(fp: string) {
        //may not be reliable
        const pageNum = this.getPageNum(fp);
        if (pageNum === 0) {
            return 0;
        }

        const totalImgSize = this.getTotalImgSize(fp);
        const videoNum = this.getVideoNum(fp);

        return util.calcAvgImgSize({ pageNum, totalImgSize, videoNum });
    }

    async handleKeyDown(event: any) {
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
            this.loadedHash = "";
            await this.askServer();
        }
    }

    hasFileSize(e: string) {
        return !!this.getFileSize(e);
    }

    countAllFileSize(files: string[]) {
        let totalSize = 0;
        files.forEach(e => {
            totalSize += this.getFileSize(e);
        });
        return totalSize;
    }

    countAllFilePageNum(filteredFiles: string[]) {
        let count = 0;
        filteredFiles.forEach(e => {
            count += this.getPageNum(e);
        });
        return count;
    }

    getFileSize(fp: string) {
        return this.allfileInfos[fp]?.size || 0;
    }

    getPageNum(fp: string) {
        return this.allfileInfos[fp]?.pageNum || 0;
    }

    getTotalImgSize(fp: string) {
        return this.allfileInfos[fp]?.totalImgSize || 0;
    }

    //may not be reliable
    getPageAvgSize(fp: string) {
        return this.allfileInfos[fp]?.pageAvgSize || 0;
    }

    getMusicNum(fp: string) {
        return this.allfileInfos[fp]?.musicNum || 0;
    }

    getVideoNum(fp: string) {
        return this.allfileInfos[fp]?.videoNum || 0;
    }

    getMtime(fp: string) {
        return this.allfileInfos[fp]?.mtimeMs || 0;
    }

    /** get tag time */
    getTTime(fp: string) {
        const fn = getBaseName(fp);
        let tTime = (nameParser as any).getDateFromParse(fn);
        tTime = tTime && tTime.getTime();
        return tTime || 0;
    }

    getReadCount(fp: string) {
        const fn = getBaseName(fp);
        const count = _parseInt(this.fileNameToHistory[fn]?.count);
        return count || 0;
    }

    getLastReadTime(fp: string) {
        const fn = getBaseName(fp);
        const rTime = _parseInt(this.fileNameToHistory[fn]?.time);
        return rTime || 0;
    }

    getFilteredFiles(options: any = {}) {
        const { skipTagFilter = false } = options;
        let files = [...this.compressFiles, ...(_.keys(this.imgFolderInfo))];

        const { pageNumRange } = this.state;

        const maxPage = pageNumRange[1] >= this.getMaxPageForSlider() ? Infinity : pageNumRange[1];
        files = files.filter(e => {
            const count = this.getPageNum(e);
            if (_.isNull(count) || count === 0) {
                return true;
            } else if (count >= pageNumRange[0] && count <= maxPage) {
                return true;
            }
            return false;
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

        const excludedTags = Array.isArray(this.state.filterTags) ? this.state.filterTags : [];
        if (!skipTagFilter && excludedTags.length > 0) {
            const excludedSet = new Set(excludedTags);
            files = files.filter(e => {
                const result = parse(e);
                let tags = [];
                if (result && Array.isArray(result.tags)) {
                    tags = result.tags;
                }
                if (!tags.length) {
                    tags = [UNTAGGED_TAG_LABEL];
                }
                return !tags.some(tag => excludedSet.has(tag));
            });
        }

        return files;
    }

    getFilteredVideos() {
        const { filterByGoodAuthorName, filterByOversizeImage, filterByGuess, filterByFirstTime, filterByHasMusic } = this.state;
        let videoFiles: string[];
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

    getFileInPage(files: string[]) {
        return files.slice((this.state.pageIndex - 1) * this.getNumPerPage(), (this.state.pageIndex) * this.getNumPerPage());
    }



    getScore(fp: string) {
        let score = this.getAuthorCountForFP(fp).score || 0;
        return score;
    }

    getAuthorCountForFP(fp: string) {
        const temp = parse(fp);
        if (temp && temp.authors) {
            // todo multiple-author
            return clientUtil.getAuthorCount(this.state.authorInfo, temp.authors[0]) || {};
        } else {
            return {};
        }
    }



    getTooltipStr(fp: string) {
        let rows: any[] = [];
        rows.push([fp]);

        rows.push(["mtime", clientUtil.dateFormat_v1(this.getMtime(fp))]);
        rows.push(["tag time", clientUtil.dateFormat_v1(this.getTTime(fp))]);

        rows.push(["     "]);
        rows.push(...(clientUtil as any).convertSimpleObj2tooltipRow(this.getAuthorCountForFP(fp)));

        rows.push(["     "]);
        rows.push(["last read time", clientUtil.dateFormat_v1(this.getLastReadTime(fp))]);
        rows.push(["read count", this.getReadCount(fp)]);

        return rows.map(row => {
            return row.join(": ");
        }).join("\n")
    }

    isImgFolder(fp: string) {
        return !!this.imgFolderInfo[fp];
    }

    getThumbnailUrl(fp: string) {
        let thumbnailurl;
        if (this.isImgFolder(fp)) {
            const tp = this.imgFolderInfo[fp].thumbnail;
            thumbnailurl = getFileUrl(tp, true);
        } else {
            thumbnailurl = getFileUrl(this.allfileInfos[fp].thumbnailFilePath, true);
        }
        return thumbnailurl;
    }

    renderSingleZipItem(fp: string) {
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

            zipItem = <SingleZipItem key={fp} filePath={fp} info={this} />
        }
        return zipItem;
    }


    renderFileList(filteredFiles: string[], filteredVideos: string[]) {
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

                let thumbnailurl = getFileUrl(this.dirThumbnailMap[item]);
                const thumbnailCn = classNames("file-cell-thumbnail", "as-folder-thumbnail");

                let imgDiv = (
                    <LoadingImage
                        className={thumbnailCn}
                        title={item}
                        filePath={item}
                        url={thumbnailurl}
                        mode={"folder"}
                        tag=""
                        musicNum={0}
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

        const videoDivGroup = _.keys(groupByVideoType).map((key, ii) => {
            let group = groupByVideoType[key];
            group.sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));

            const videoItems = group.map((item: string) => {
                const toUrl = clientUtil.getVideoPlayerLink(item);
                const text = getBaseName(item);
                const result = getOneLineListItem(<i className="far fa-file-video"></i>, text, item, this);
                return (
                    <Link target="_blank" to={toUrl} key={item}>{result}</Link>
                );
            });
            return <ItemsContainer key={key} className="video-list" items={videoItems} />
        })



        files = this.getFileInPage(files);

        let zipfileItems: ReactNode[] | ReactNode;
        if (sortOrder === BY_FOLDER || sortOrder === BY_FOLDER &&
            (this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH)) {

            zipfileItems = <FileGroupZipPanel files={files} isSortAsc={this.state.isSortAsc} info={this} />
        } else {
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
                {(Array.isArray(zipfileItems) ? zipfileItems.length > 0 : !!zipfileItems) && this.renderSortHeader()}
                <div className={"file-grid container"}>
                    <div className={rowCn}>
                        {zipfileItems}
                    </div>
                </div>
            </div>
        );
    }

    getMaxPageForSlider() {
        return Math.min(DEFAULT_MAX_PAGE, this.maxPageNum);
    }

    renderPageRangeSilder() {
        const { pageNumRange } = this.state;
        const maxForSilder = this.getMaxPageForSlider();
        const righttext = pageNumRange[1] >= maxForSilder ? `${this.maxPageNum}/${this.maxPageNum}` : `${pageNumRange[1]}/${this.maxPageNum}`

        return (
            <div className='page-number-range-slider-wrapper'>
                <div className='small-text-title no-wrap' >Page Range:</div>
                <div className='small-text-title'>{pageNumRange[0]} </div>
                <RangeSlider className="page-number-range-slider"
                    min={this.minPageNum} max={maxForSilder} step={1}
                    value={pageNumRange}
                    onInput={(range: any) => {
                        if (range[0] === pageNumRange[0] && range[1] === pageNumRange[1]) {
                            //
                        } else {
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
        if (res && !(res as any).isFailed()) {
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

    renderLevelButton() {
        const text = this.state.isRecursive ? "Show Only One Level" : "Show Files in Subfolders";
        return (
            <span className="recursive-button exp-top-button" onClick={this.toggleRecursively.bind(this)}>
                <span className="fas fa-glasses" />
                <span> {text} </span>
            </span>
        );
    }

    renderChartButton() {
        const table: any = {}
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
                <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={() => askPregenerate(this.getPathFromQuery())}>
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

    getExplorerToolbar(filteredFiles: string[], filteredVideos: string[]) {
        const mode = this.getMode();


        const isExplorer = mode === MODE_EXPLORER && this.getPathFromQuery();
        const isTag = mode === MODE_TAG;
        const isAuthor = mode == MODE_AUTHOR;
        const url = clientUtil.getSearhLink(this.getTextFromQuery());

        const isInfoMode = !this.isLackInfoMode();

        const warning = this.isLackInfoMode() && (
            <NoScanAlertArea filePath={this.getTextFromQuery()}></NoScanAlertArea>
        );

        let topButtons = (
            <div className="top-button-gropus row">
                <div className="col-6 col-md-4"> {this.renderToggleFolferThumbNailButton()} </div>
                <div className="col-6 col-md-4"> {this.renderToggleThumbNailButton()} </div>

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
            </div>);

        const globalContext = this.context as GlobalContextType;
        const breadcrumb = isExplorer && (<div className="row">
            <Breadcrumb sep={globalContext.file_path_sep}
                server_os={globalContext.server_os}
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
        return "";
    }

    getLinkToEhentai() {
        let searchable: any = this.tag || this.author;
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

    renderPagination(filteredFiles: string[], filteredVideos: string[]) {
        const fileLength = filteredFiles.length;
        return (<div className="pagination-container">
            <Pagination ref={(ref: any) => this.pagination = ref}
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

    onSortChange(sortOrder: any, isSortAsc: boolean) {
        this.setStateAndSetHash({ sortOrder, isSortAsc })
    }

    toggleFilter(key: any) {
        let filterArr = this.state.filterArr.slice();
        const index = filterArr.indexOf(key)

        if (index > -1) {
            filterArr.splice(index, 1)
        } else {
            filterArr.push(key);
        }

        this.setStateAndSetHash({
            filterArr,
            pageIndex: 1
        });
    }

    isOn(key: any) {
        return this.state.filterArr.includes(key);
    }

    toggleTagFilterSelection(tag: any) {
        const excludedTags = new Set(Array.isArray(this.state.filterTags) ? this.state.filterTags : []);
        if (excludedTags.has(tag)) {
            excludedTags.delete(tag);
        } else {
            excludedTags.add(tag);
        }

        this.setTagFilters(Array.from(excludedTags));
    }

    setTagFilters(filterTags: any) {
        const nextFilterTags = Array.isArray(filterTags) ? filterTags : [];
        this.setStateAndSetHash({
            filterTags: nextFilterTags,
            pageIndex: 1
        });
    }

    resetTagFilters() {
        this.setTagFilters([]);
    }

    renderFilterTagPanel() {
        const filesForPanel = this.getFilteredFiles({ skipTagFilter: true });

        const tag2Freq: any = {};
        filesForPanel.forEach(fp => {
            const result = parse(fp);
            let tags: string[] = [];
            if (result && Array.isArray(result.tags)) {
                tags = result.tags;
            }
            if (!tags.length) {
                tags = [UNTAGGED_TAG_LABEL];
            }

            tags.forEach(tag => {
                tag2Freq[tag] = tag2Freq[tag] || 0;
                tag2Freq[tag]++;
            });
        });

        const tags = _.keys(tag2Freq).sort((a, b) => {
            if (a === UNTAGGED_TAG_LABEL && b !== UNTAGGED_TAG_LABEL) {
                return 1;
            }
            if (b === UNTAGGED_TAG_LABEL && a !== UNTAGGED_TAG_LABEL) {
                return -1;
            }
            if (tag2Freq[b] === tag2Freq[a]) {
                return a.localeCompare(b, undefined, { numeric: true });
            }
            return tag2Freq[b] - tag2Freq[a];
        });

        const excludedTags = new Set(Array.isArray(this.state.filterTags) ? this.state.filterTags : []);

        const items = tags
            .filter(tag => tag2Freq[tag] > 2)
            .map(tag => {
                const label = `${tag} (${tag2Freq[tag]})`;
                return {
                    value: tag,
                    label,
                    checked: !excludedTags.has(tag)
                };
            });

        const deselectAllTags = () => {
            this.setTagFilters(tags.slice());
        };

        return (
            <FilterPanel
                title="Filter Tags"
                items={items}
                onToggle={this.toggleTagFilterSelection.bind(this)}
                onSelectAll={this.resetTagFilters.bind(this)}
                onDeselectAll={deselectAllTags}
                className="filter-type-panel"
            />
        );
    }

    renderSortHeader() {
        let sortOptions = (ClientConstant as any).SORT_OPTIONS.slice();

        if (this.getMode() !== MODE_EXPLORER) {
            sortOptions.push(BY_FOLDER);
        }

        return (<div className="sort-header-container container">
            <SortHeader sortOptions={sortOptions} selected={this.state.sortOrder}
                isSortAsc={this.state.isSortAsc}
                onChange={this.onSortChange.bind(this)}
                className=""
                options={sortOptions}
            />
        </div>);
    }

    renderCheckboxPanel() {
        const filters = [
            { id: 'FILTER_HAS_MUSIC', label: 'Has Music' },
            { id: 'FILTER_HAS_VIDEO', label: 'Has Video' },
            { id: 'FILTER_IMG_FOLDER', label: 'Image Folders Only' }
        ];

        const checkboxes = filters.map(filter => (
            <Checkbox
                key={filter.id}
                onChange={this.toggleFilter.bind(this, filter.id)}
                checked={this.isOn(filter.id)}
            >
                {filter.label}
            </Checkbox>
        ));

        return (
            <div className="aji-checkbox-container">
                {checkboxes}
            </div>
        );
    }

    renderFilterControls() {
        return (
            <>
                <div className="explorer-filter-panel container">
                    <div className='small-wrapper'>
                        <div className="explorer-filter-panel__row explorer-filter-panel__row--controls">
                            {this.renderPageRangeSilder()}
                            {this.renderCheckboxPanel()}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    render(): ReactNode {
        this.setWebTitle();

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res} />;
        }

        const filteredFiles = this.getFilteredFiles();
        const filteredVideos = this.getFilteredVideos();

        const cn = classNames("explorer-container-out", this.getMode().replace(" ", "_"));

        return (<div className={cn} >
            {this.getLinkToEhentai()}
            {this.getExplorerToolbar(filteredFiles, filteredVideos)}
            {this.renderFileList(filteredFiles, filteredVideos)}
            {this.renderPagination(filteredFiles, filteredVideos)}
        </div>
        );
    }
}

(ExplorerPage as any).contextType = GlobalContext;

export default ExplorerPage;
