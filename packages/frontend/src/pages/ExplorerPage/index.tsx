
import React, { ReactNode, useState, useRef, useEffect, useCallback, useContext } from 'react';
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
    FileInfo,
    ImgFolderInfo,
    FileHistory,
    ListDirResponse,
    SearchFileResponse,
    TagInfo,
    ApiResponse,
    GoodAuthorNamesResponse
} from '@common/types';

interface ExplorerPageProps {
    location: any;
    filterText?: string;
}

interface ExplorerPageState {
    perPageItemNum: number;
    pageIndex: number;
    isRecursive: boolean;
    sortOrder: string;
    isSortAsc: boolean;
    showFolderThumbnail: boolean;
    filterArr: string[];
    pageNumRange: [number, number];
    filterText: string;
    filterTags: string[];
    noThumbnail: boolean;
    authorInfo?: any[];
    tagInfo?: any[];
    [key: string]: any; // To support dynamic state for now
}

interface MetaInfo {
    key: string;
    type: "int" | "boolean" | "str" | "arr" | "float";
    defVal?: any;
}

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

const metaInfo: MetaInfo[] = [
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

function getInitState(reset?: boolean): ExplorerPageState {
    const initState = clientUtil.getInitState(metaInfo, reset);
    return {
        perPageItemNum: getPerPageItemNumber(),
        ...initState
    } as ExplorerPageState;
}

const ExplorerPage: React.FC<ExplorerPageProps> = (props) => {
    const globalContext = useContext(GlobalContext) as GlobalContextType;

    // State
    const [state, setState] = useState<ExplorerPageState>(() => getInitState());

    // Refs for instance variables
    const loadedHashRef = useRef<string>("");
    const videoFilesRef = useRef<string[]>([]);
    const compressFilesRef = useRef<string[]>([]);
    const imageFilesRef = useRef<string[]>([]);
    const musicFilesRef = useRef<string[]>([]);
    const dirsRef = useRef<string[]>([]);
    const tagRef = useRef<string>("");
    const authorRef = useRef<string>("");
    const fileInfosRef = useRef<Record<string, FileInfo>>({});
    const imgFolderInfoRef = useRef<Record<string, ImgFolderInfo>>({});
    const resRef = useRef<ApiResponse<ListDirResponse | SearchFileResponse> | null>(null);
    const dirThumbnailMapRef = useRef<Record<string, string>>({});
    const minPageNumRef = useRef<number>(0);
    const maxPageNumRef = useRef<number>(0);
    const modeRef = useRef<string>("");
    const allfileInfosRef = useRef<Record<string, FileInfo | ImgFolderInfo>>({});
    const fileNameToHistoryRef = useRef<Record<string, { time: number, count: number }>>({});
    const hasCalled_getThumbnailForFoldersRef = useRef<boolean>(false);
    const paginationRef = useRef<any>(null);

    // Helper functions
    const getNumPerPage = useCallback(() => {
        return (state.noThumbnail || state.sortOrder === BY_FOLDER) ?
            1000 : state.perPageItemNum;
    }, [state.noThumbnail, state.sortOrder, state.perPageItemNum]);

    const setStateAndSetHash = useCallback((newState: Partial<ExplorerPageState>, callback?: () => void) => {
        setState(prev => {
            const updated = { ...prev, ...newState };
            clientUtil.saveStateToUrl(metaInfo, updated);
            return updated;
        });
        if (callback) {
            // Execute callback after state update
            setTimeout(callback, 0);
        }
    }, []);

    const handlePageChange = useCallback((index: number) => {
        if ((window.event as any) && (window.event as any).ctrlKey) {
            return;
        }
        setStateAndSetHash({ pageIndex: index });
    }, [setStateAndSetHash]);

    const next = useCallback(() => {
        if (paginationRef.current && paginationRef.current.hasNext()) {
            let nextPage = state.pageIndex + 1;
            handlePageChange(nextPage);
        }
    }, [state.pageIndex, handlePageChange]);

    const prev = useCallback(() => {
        if (paginationRef.current && paginationRef.current.hasPrev()) {
            let prevPage = state.pageIndex - 1;
            handlePageChange(prevPage);
        }
    }, [state.pageIndex, handlePageChange]);

    const getPathFromQuery = useCallback((propsOverride?: any) => {
        const _props = propsOverride || props;
        return queryString.parse(_props.location.search)["p"] as string || "";
    }, [props]);

    const getMode = useCallback((propsOverride?: any) => {
        const _props = propsOverride || props;
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
    }, [props]);

    const getSearchTextFromQuery = useCallback((propsOverride?: any) => {
        const _props = propsOverride || props;
        if (getMode(_props) === MODE_SEARCH) {
            let str = _props.location.search || _props.location.pathname;
            str = str.replace("/search/?", "")
            return queryString.parse(str)["s"] as string || "";
        }
        return "";
    }, [props, getMode]);

    const getAuthorFromQuery = useCallback((propsOverride?: any) => {
        const _props = propsOverride || props;
        return queryString.parse(_props.location.search)["a"] as string || "";
    }, [props]);

    const getTagFromQuery = useCallback((propsOverride?: any) => {
        const _props = propsOverride || props;
        return queryString.parse(_props.location.search)["t"] as string || "";
    }, [props]);

    const getTextFromQuery = useCallback((propsOverride?: any) => {
        const _props = propsOverride || props;
        return getTagFromQuery(_props) ||
            getAuthorFromQuery(_props) ||
            getSearchTextFromQuery(_props) ||
            getPathFromQuery(_props);
    }, [getTagFromQuery, getAuthorFromQuery, getSearchTextFromQuery, getPathFromQuery]);

    const isLackInfoMode = useCallback(() => {
        return modeRef.current === "lack_info_mode";
    }, []);

    const getFileSize = useCallback((fp: string) => {
        return allfileInfosRef.current[fp]?.size || 0;
    }, []);

    const getPageNum = useCallback((fp: string) => {
        return allfileInfosRef.current[fp]?.pageNum || 0;
    }, []);

    const getTotalImgSize = useCallback((fp: string) => {
        return allfileInfosRef.current[fp]?.totalImgSize || 0;
    }, []);

    const getPageAvgSize = useCallback((fp: string) => {
        return (allfileInfosRef.current[fp] as any)?.pageAvgSize || 0;
    }, []);

    const getMusicNum = useCallback((fp: string) => {
        return allfileInfosRef.current[fp]?.musicNum || 0;
    }, []);

    const getVideoNum = useCallback((fp: string) => {
        return allfileInfosRef.current[fp]?.videoNum || 0;
    }, []);

    const getMtime = useCallback((fp: string) => {
        return allfileInfosRef.current[fp]?.mtimeMs || 0;
    }, []);

    const getTTime = useCallback((fp: string) => {
        const fn = getBaseName(fp);
        let tTime = (nameParser as any).getDateFromParse(fn);
        tTime = tTime && tTime.getTime();
        return tTime || 0;
    }, []);

    const getReadCount = useCallback((fp: string) => {
        const fn = getBaseName(fp);
        const count = _parseInt(fileNameToHistoryRef.current[fn]?.count);
        return count || 0;
    }, []);

    const getLastReadTime = useCallback((fp: string) => {
        const fn = getBaseName(fp);
        const rTime = _parseInt(fileNameToHistoryRef.current[fn]?.time);
        return rTime || 0;
    }, []);

    const hasFileSize = useCallback((e: string) => {
        return !!getFileSize(e);
    }, [getFileSize]);

    const countAllFileSize = useCallback((files: string[]) => {
        let totalSize = 0;
        files.forEach(e => {
            totalSize += getFileSize(e);
        });
        return totalSize;
    }, [getFileSize]);

    const countAllFilePageNum = useCallback((filteredFiles: string[]) => {
        let count = 0;
        filteredFiles.forEach(e => {
            count += getPageNum(e);
        });
        return count;
    }, [getPageNum]);

    const getScore = useCallback((fp: string) => {
        let score = getAuthorCountForFP(fp).score || 0;
        return score;
    }, []);

    const getAuthorCountForFP = useCallback((fp: string) => {
        const temp = parse(fp);
        if (temp && temp.authors) {
            // todo multiple-author
            return clientUtil.getAuthorCount(state.authorInfo, temp.authors[0]) || {};
        } else {
            return {};
        }
    }, [state.authorInfo]);

    const getTooltipStr = useCallback((fp: string) => {
        let rows: any[] = [];
        rows.push([fp]);

        rows.push(["mtime", clientUtil.dateFormat_v1(getMtime(fp))]);
        rows.push(["tag time", clientUtil.dateFormat_v1(getTTime(fp))]);

        rows.push(["     "]);
        rows.push(...(clientUtil as any).convertSimpleObj2tooltipRow(getAuthorCountForFP(fp)));

        rows.push(["     "]);
        rows.push(["last read time", clientUtil.dateFormat_v1(getLastReadTime(fp))]);
        rows.push(["read count", getReadCount(fp)]);

        return rows.map(row => {
            return row.join(": ");
        }).join("\n")
    }, [getMtime, getTTime, getAuthorCountForFP, getLastReadTime, getReadCount]);

    const isImgFolder = useCallback((fp: string) => {
        return !!imgFolderInfoRef.current[fp];
    }, []);

    const getThumbnailUrl = useCallback((fp: string) => {
        let thumbnailurl;
        if (isImgFolder(fp)) {
            const tp = (imgFolderInfoRef.current[fp] as ImgFolderInfo).thumbnail;
            thumbnailurl = getFileUrl(tp, true);
        } else {
            thumbnailurl = getFileUrl((allfileInfosRef.current[fp] as FileInfo).thumbnailFilePath, true);
        }
        return thumbnailurl;
    }, [isImgFolder]);

    const getMaxPageForSlider = useCallback(() => {
        return Math.min(DEFAULT_MAX_PAGE, maxPageNumRef.current);
    }, []);

    const isFailedLoading = useCallback(() => {
        return resRef.current && resRef.current.isFailed();
    }, []);

    const isOn = useCallback((key: any) => {
        return state.filterArr.includes(key);
    }, [state.filterArr]);

    const getFilteredFiles = useCallback((options: any = {}) => {
        const { skipTagFilter = false } = options;
        let files = [...compressFilesRef.current, ...(_.keys(imgFolderInfoRef.current))];

        const { pageNumRange } = state;

        const maxPage = pageNumRange[1] >= getMaxPageForSlider() ? Infinity : pageNumRange[1];
        files = files.filter(e => {
            const count = getPageNum(e);
            if (_.isNull(count) || count === 0) {
                return true;
            } else if (count >= pageNumRange[0] && count <= maxPage) {
                return true;
            }
            return false;
        })

        if (isOn(FILTER_HAS_MUSIC)) {
            files = files.filter(e => {
                return getMusicNum(e) > 0;
            })
        }

        if (isOn(FILTER_HAS_VIDEO)) {
            files = files.filter(e => {
                return getVideoNum(e) > 0;
            })
        }

        if (isOn(FILTER_IMG_FOLDER)) {
            files = files.filter(e => {
                return !isCompress(e);
            })
        }

        const filterText = _.isString(state.filterText) && state.filterText.toLowerCase();
        if (filterText) {
            files = files.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }

        const excludedTags = Array.isArray(state.filterTags) ? state.filterTags : [];
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
    }, [state.pageNumRange, state.filterText, state.filterTags, getMaxPageForSlider, getPageNum, getMusicNum, getVideoNum, isOn]);

    const getFilteredVideos = useCallback(() => {
        const { filterByGoodAuthorName, filterByOversizeImage, filterByGuess, filterByFirstTime, filterByHasMusic } = state;
        let videoFiles: string[];
        if (filterByGoodAuthorName || filterByOversizeImage || filterByGuess || filterByFirstTime || filterByHasMusic) {
            videoFiles = [];
        } else {
            videoFiles = videoFilesRef.current || [];
        }

        const filterText = state.filterText && state.filterText.toLowerCase();
        if (filterText) {
            return videoFiles.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        } else {
            return videoFiles;
        }
    }, [state]);

    const getFileInPage = useCallback((files: string[]) => {
        return files.slice((state.pageIndex - 1) * getNumPerPage(), (state.pageIndex) * getNumPerPage());
    }, [state.pageIndex, getNumPerPage]);

    // Create info object for child components
    const createInfoObject = useCallback(() => {
        return {
            getFileSize,
            getPageNum,
            getTotalImgSize,
            getPageAvgSize,
            getMusicNum,
            getVideoNum,
            getMtime,
            getTTime,
            getReadCount,
            getLastReadTime,
            hasFileSize,
            countAllFileSize,
            countAllFilePageNum,
            getScore,
            getAuthorCountForFP,
            getTooltipStr,
            isImgFolder,
            getThumbnailUrl,
            getMaxPageForSlider,
            isFailedLoading,
            isOn,
            getFilteredFiles,
            getFilteredVideos,
            getFileInPage,
            isLackInfoMode,
            getTextFromQuery,
            getMode,
            state,
            allfileInfos: allfileInfosRef.current,
            imgFolderInfo: imgFolderInfoRef.current,
            fileInfos: fileInfosRef.current,
            musicFiles: musicFilesRef.current,
            imageFiles: imageFilesRef.current,
            dirs: dirsRef.current,
            context: globalContext,
            // renderSingleZipItem will be added later via renderSingleZipItemRef
            renderSingleZipItem: (fp: string) => renderSingleZipItemRef.current?.(fp),
        };
    }, [
        getFileSize, getPageNum, getTotalImgSize, getPageAvgSize, getMusicNum, getVideoNum,
        getMtime, getTTime, getReadCount, getLastReadTime, hasFileSize, countAllFileSize,
        countAllFilePageNum, getScore, getAuthorCountForFP, getTooltipStr, isImgFolder,
        getThumbnailUrl, getMaxPageForSlider, isFailedLoading, isOn, getFilteredFiles,
        getFilteredVideos, getFileInPage, isLackInfoMode, getTextFromQuery, getMode, state, globalContext
    ]);

    // Ref for renderSingleZipItem to break circular dependency
    const renderSingleZipItemRef = useRef<((fp: string) => ReactNode) | null>(null);

    // Reset params
    const resetParam = useCallback(() => {
        loadedHashRef.current = "";
        videoFilesRef.current = [];
        compressFilesRef.current = [];
        imageFilesRef.current = [];
        musicFilesRef.current = [];
        dirsRef.current = [];
        tagRef.current = "";
        authorRef.current = "";
        fileInfosRef.current = {};
        imgFolderInfoRef.current = {};
        resRef.current = null;
        dirThumbnailMapRef.current = {};
    }, []);

    const calculateAvgPageSize = useCallback((fp: string) => {
        const pageNum = getPageNum(fp);
        if (pageNum === 0) {
            return 0;
        }

        const totalImgSize = getTotalImgSize(fp);
        const videoNum = getVideoNum(fp);

        return util.calcAvgImgSize({ pageNum, totalImgSize, videoNum });
    }, [getPageNum, getTotalImgSize, getVideoNum]);

    const decorate_allfileInfos = useCallback(() => {
        for (const fp in allfileInfosRef.current) {
            if (!allfileInfosRef.current.hasOwnProperty(fp)) {
                continue;
            }

            const info = allfileInfosRef.current[fp] as any;
            info.size = _parseInt(info.size) || 0;
            info.mtimeMs = _parseInt(info.mtimeMs) || 0;

            info.musicNum = _parseInt(info.musicNum) || 0;
            info.videoNum = _parseInt(info.videoNum) || 0;
            info.pageNum = _parseInt(info.pageNum) || 0;

            info.totalImgSize = _parseInt(info.totalImgSize) || 0;
            info.pageAvgSize = calculateAvgPageSize(fp) || 0;
        }
    }, [calculateAvgPageSize]);

    const askRerender = useCallback(() => {
        setState(prev => ({
            ...prev,
            rerenderTick: !prev.rerenderTick
        }));
    }, []);

    const requestThumbnailForFolder = useCallback(async () => {
        const res = await getFolderListThumbnails(dirsRef.current);
        if (res && !(res as any).isFailed()) {
            dirThumbnailMapRef.current = res.json.dirThumbnails;
            hasCalled_getThumbnailForFoldersRef.current = true;
            askRerender();
        }
    }, [askRerender]);

    const handleLsDirRes = useCallback(async (res: ApiResponse<ListDirResponse | SearchFileResponse>) => {
        if (res && !res.isFailed()) {
            let {
                dirs = [],
                mode = "",
                tag = "",
                author = "",
                fileInfos = {},
                imgFolderInfo = {},
                fileHistory = [],
                nameParseCache = {}
            } = res.json as any;

            // 马上叫server准备下一个信息
            getGoodAuthorNames().then((res: ApiResponse<GoodAuthorNamesResponse>) => {
                if (res && !res.isFailed()) {
                    setState(prev => ({
                        ...prev,
                        authorInfo: res.json.authorInfo,
                        tagInfo: res.json.tagInfo
                    }));
                }
            });

            (nameParser as any).setLocalCache(nameParseCache);
            loadedHashRef.current = getTextFromQuery();
            modeRef.current = mode;
            fileInfosRef.current = fileInfos;
            const files = _.keys(fileInfosRef.current) || [];
            videoFilesRef.current = files.filter(isVideo);
            compressFilesRef.current = files.filter(isCompress);
            musicFilesRef.current = files.filter(isMusic);
            imageFilesRef.current = files.filter(isImage);

            sortFileNames(musicFilesRef.current);
            sortFileNames(imageFilesRef.current);

            dirsRef.current = dirs;
            dirsRef.current.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            tagRef.current = tag;
            authorRef.current = author;
            imgFolderInfoRef.current = imgFolderInfo;
            resRef.current = res;
            allfileInfosRef.current = _.extend({}, fileInfosRef.current, imgFolderInfoRef.current);
            decorate_allfileInfos();

            fileNameToHistoryRef.current = {};
            fileHistory.forEach((row: any) => {
                const { fileName, time, count } = row;
                fileNameToHistoryRef.current[fileName] = { time, count };
            });

            // 找出最大页数
            let _maxPage = 10;
            files.forEach(e => {
                const count = getPageNum(e);
                _maxPage = Math.max(_maxPage, count);
            });
            minPageNumRef.current = 0;
            maxPageNumRef.current = _maxPage;

            // check pageindex
            const availableFiles = getFileInPage(getFilteredFiles());

            if (availableFiles.length === 0) {
                handlePageChange(1);
            } else {
                askRerender();
            }

            hasCalled_getThumbnailForFoldersRef.current = false;
            if (state.showFolderThumbnail) {
                requestThumbnailForFolder();
            }
        } else {
            resRef.current = res;
            askRerender();
        }
    }, [getTextFromQuery, decorate_allfileInfos, getPageNum, getFileInPage, getFilteredFiles, handlePageChange, askRerender, state.showFolderThumbnail, requestThumbnailForFolder]);

    const askServer = useCallback(async () => {
        let res;
        if (getMode() === MODE_EXPLORER) {
            const hash = getTextFromQuery();
            if (hash && loadedHashRef.current !== hash) {
                res = await listDirectory({ dir: getTextFromQuery(), isRecursive: state.isRecursive });
                await handleLsDirRes(res);
            }
        } else {
            const hash = getTextFromQuery();
            if (hash && loadedHashRef.current !== hash) {
                if (getMode() === MODE_TAG) {
                    res = await searchFiles({ text: getTextFromQuery(), mode: getMode() });
                } else if (getMode() === MODE_AUTHOR) {
                    res = await searchFiles({ text: getTextFromQuery(), mode: getMode() });
                } else if (getMode() === MODE_SEARCH) {
                    res = await searchFiles({ text: getSearchTextFromQuery(), mode: getMode() });
                }
            }
            if (res) {
                await handleLsDirRes(res);
            }
        }
    }, [getMode, getTextFromQuery, getSearchTextFromQuery, state.isRecursive, handleLsDirRes]);

    const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
        if (isSearchInputTextTyping()) {
            return;
        }

        const key = event.key.toLowerCase();
        if (key === "arrowright" || key === "d" || key === "l") {
            next();
            event.preventDefault();
        } else if (key === "arrowleft" || key === "a" || key === "j") {
            prev();
            event.preventDefault();
        } else if (key == "r") {
            loadedHashRef.current = "";
            await askServer();
        }
    }, [next, prev, askServer]);

    // Effects
    useEffect(() => {
        askServer();
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            clientUtil.setSearchInputText("");
        };
    }, []);

    // Handle filterText prop changes (equivalent to getDerivedStateFromProps)
    useEffect(() => {
        if (_.isString(props.filterText) && props.filterText !== state.filterText) {
            setState(prev => ({
                ...prev,
                filterText: props.filterText || '',
                pageIndex: 1
            }));
        }
    }, [props.filterText]);

    // Handle route changes (equivalent to componentDidUpdate)
    const prevPropsRef = useRef(props);
    useEffect(() => {
        const prevProps = prevPropsRef.current;
        const prevMode = getMode(prevProps);
        const prevHash = getTextFromQuery(prevProps);
        const differentMode = getMode() !== prevMode;
        const sameMode = !differentMode;
        const pathChanged = !!(sameMode && getTextFromQuery() !== prevHash);

        if (differentMode || pathChanged) {
            resetParam();
            setState(getInitState(true));
            askServer();
        }

        if (getMode() === MODE_TAG || getMode() === MODE_AUTHOR || getMode() === MODE_SEARCH) {
            const text = getTextFromQuery();
            clientUtil.setSearchInputText(text);
        } else {
            clientUtil.setSearchInputText("");
        }

        prevPropsRef.current = props;
    }, [props.location.pathname, props.location.search]);

    // Toggle functions
    const toggleRecursively = useCallback(() => {
        resetParam();
        setStateAndSetHash({
            pageIndex: 1,
            isRecursive: !state.isRecursive
        }, () => {
            (async () => {
                let res = await listDirectory({ dir: getTextFromQuery(), isRecursive: !state.isRecursive });
                handleLsDirRes(res);
            })();
        });
    }, [resetParam, setStateAndSetHash, state.isRecursive, getTextFromQuery, handleLsDirRes]);

    const toggleThumbNail = useCallback(() => {
        const prev = state.noThumbnail;
        const next = !prev;
        setStateAndSetHash({ noThumbnail: next });
    }, [state.noThumbnail, setStateAndSetHash]);

    const toggleFolderThumbNail = useCallback(async () => {
        const next = !state.showFolderThumbnail;
        setStateAndSetHash({ showFolderThumbnail: next });

        if (next && !hasCalled_getThumbnailForFoldersRef.current) {
            requestThumbnailForFolder();
        }
    }, [state.showFolderThumbnail, setStateAndSetHash, requestThumbnailForFolder]);

    const toggleFilter = useCallback((key: any) => {
        let filterArr = state.filterArr.slice();
        const index = filterArr.indexOf(key);

        if (index > -1) {
            filterArr.splice(index, 1);
        } else {
            filterArr.push(key);
        }

        setStateAndSetHash({
            filterArr,
            pageIndex: 1
        });
    }, [state.filterArr, setStateAndSetHash]);

    const toggleTagFilterSelection = useCallback((tag: any) => {
        const excludedTags = new Set(Array.isArray(state.filterTags) ? state.filterTags : []);
        if (excludedTags.has(tag)) {
            excludedTags.delete(tag);
        } else {
            excludedTags.add(tag);
        }

        setTagFilters(Array.from(excludedTags));
    }, [state.filterTags]);

    const setTagFilters = useCallback((filterTags: any) => {
        const nextFilterTags = Array.isArray(filterTags) ? filterTags : [];
        setStateAndSetHash({
            filterTags: nextFilterTags,
            pageIndex: 1
        });
    }, [setStateAndSetHash]);

    const resetTagFilters = useCallback(() => {
        setTagFilters([]);
    }, [setTagFilters]);

    const onSortChange = useCallback((sortOrder: any, isSortAsc: boolean) => {
        setStateAndSetHash({ sortOrder, isSortAsc });
    }, [setStateAndSetHash]);

    const toggleItemNum = useCallback(() => {
        let nv = state.perPageItemNum + 12;
        nv = Math.min(nv, 108);
        setStateAndSetHash({
            perPageItemNum: nv,
            pageIndex: Math.min(Math.ceil(getFilteredFiles().length / nv), state.pageIndex)
        });
    }, [state.perPageItemNum, state.pageIndex, getFilteredFiles, setStateAndSetHash]);

    const getTitle = useCallback(() => {
        const mode = getMode();

        if (tagRef.current && mode === MODE_TAG) {
            return "Tag: " + tagRef.current;
        } else if (authorRef.current && mode === MODE_AUTHOR) {
            return "Author: " + authorRef.current;
        } else if (mode === MODE_SEARCH) {
            return "Search Result: " + getTextFromQuery();
        }
        return "";
    }, [getMode, getTextFromQuery]);

    const setWebTitle = useCallback(() => {
        document.title = getTextFromQuery() || "ShiguReader";
    }, [getTextFromQuery]);

    // Render functions
    const renderSingleZipItem = useCallback((fp: string) => {
        const text = getBaseName(fp);
        const toUrl = clientUtil.getBookReadLink(fp);
        const info = createInfoObject();

        let zipItem;
        let thumbnailurl = getThumbnailUrl(fp);

        if (state.noThumbnail) {
            zipItem = (
                <Link target="_blank" to={toUrl} key={fp} className={""} >
                    <ThumbnailPopup filePath={fp} url={thumbnailurl}>
                        {getOneLineListItem(<i className="fas fa-book"></i>, text, fp, info)}
                    </ThumbnailPopup>
                </Link>);
        } else {
            zipItem = <SingleZipItem key={fp} filePath={fp} info={info} />;
        }
        return zipItem;
    }, [state.noThumbnail, getThumbnailUrl, createInfoObject]);

    // Update ref so it can be accessed via info.renderSingleZipItem
    renderSingleZipItemRef.current = renderSingleZipItem;

    const renderPageRangeSilder = useCallback(() => {
        const { pageNumRange } = state;
        const maxForSilder = getMaxPageForSlider();
        const righttext = pageNumRange[1] >= maxForSilder ? `${maxPageNumRef.current}/${maxPageNumRef.current}` : `${pageNumRange[1]}/${maxPageNumRef.current}`;

        return (
            <div className='page-number-range-slider-wrapper'>
                <div className='small-text-title no-wrap' >Page Range:</div>
                <div className='small-text-title'>{pageNumRange[0]} </div>
                <RangeSlider className="page-number-range-slider"
                    min={minPageNumRef.current} max={maxForSilder} step={1}
                    value={pageNumRange}
                    onInput={(range: any) => {
                        if (range[0] === pageNumRange[0] && range[1] === pageNumRange[1]) {
                            //
                        } else {
                            setStateAndSetHash({ pageNumRange: range });
                        }
                    }} />
                <div className='small-text-title'>{righttext}</div>
            </div>);
    }, [state.pageNumRange, getMaxPageForSlider, setStateAndSetHash]);

    const renderToggleThumbNailButton = useCallback(() => {
        const text2 = state.noThumbnail ? "File Thumbnail" : "File Name Only";
        return (
            <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={toggleThumbNail}>
                <span className="fas fa-book" /> <span>{text2} </span>
            </span>
        );
    }, [state.noThumbnail, toggleThumbNail]);

    const renderToggleFolferThumbNailButton = useCallback(() => {
        const text2 = state.showFolderThumbnail ? "Folder Name Only" : "Folder Thumbnail";
        return (
            <span key="folder-thumbnail-button" className="thumbnail-button exp-top-button" onClick={toggleFolderThumbNail}>
                <span className="fas fa-book" /> <span>{text2} </span>
            </span>
        );
    }, [state.showFolderThumbnail, toggleFolderThumbNail]);

    const renderLevelButton = useCallback(() => {
        const text = state.isRecursive ? "Show Only One Level" : "Show Files in Subfolders";
        return (
            <span className="recursive-button exp-top-button" onClick={toggleRecursively}>
                <span className="fas fa-glasses" />
                <span> {text} </span>
            </span>
        );
    }, [state.isRecursive, toggleRecursively]);

    const renderChartButton = useCallback(() => {
        const table: any = {};
        table[MODE_AUTHOR] = "/chart/?a=";
        table[MODE_EXPLORER] = "/chart/?p=";
        table[MODE_SEARCH] = "/chart/?s=";
        table[MODE_TAG] = "/chart/?t=";
        let link = table[getMode()] + getTextFromQuery();
        if (state.isRecursive) {
            link += "&isRecursive=true";
        }

        return (<Link target="_blank" className="exp-top-button" to={link}>
            <span className="fas fa-chart-line" />
            <span> Chart </span>
        </Link>);
    }, [getMode, getTextFromQuery, state.isRecursive]);

    const renderPregenerateButton = useCallback(() => {
        if (getMode() === MODE_EXPLORER) {
            const text = "Generate Thumbnail";
            return (
                <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={() => askPregenerate(getPathFromQuery())}>
                    <span className="fas fa-tools" />
                    <span> {text} </span>
                </span>
            );
        }
        return null;
    }, [getMode, getPathFromQuery]);

    const getBookModeLink = useCallback(() => {
        const bookReadUrl = clientUtil.getBookReadLink(getTextFromQuery());
        return (
            <Link target="_blank" className="exp-top-button" to={bookReadUrl} >
                <span className="fas fa-book-reader" />
                <span>Open in Book Mode </span>
            </Link>
        );
    }, [getTextFromQuery]);

    const renderPagination = useCallback((filteredFiles: string[], filteredVideos: string[]) => {
        const fileLength = filteredFiles.length;
        return (<div className="pagination-container">
            <Pagination ref={(ref: any) => paginationRef.current = ref}
                currentPage={state.pageIndex}
                itemPerPage={getNumPerPage()}
                totalItemNum={fileLength}
                onChange={handlePageChange}
                onExtraButtonClick={toggleItemNum}
                linkFunc={clientUtil.linkFunc}
            /></div>);
    }, [state.pageIndex, getNumPerPage, handlePageChange, toggleItemNum]);

    const renderCheckboxPanel = useCallback(() => {
        const filters = [
            { id: 'FILTER_HAS_MUSIC', label: 'Has Music' },
            { id: 'FILTER_HAS_VIDEO', label: 'Has Video' },
            { id: 'FILTER_IMG_FOLDER', label: 'Image Folders Only' }
        ];

        const checkboxes = filters.map(filter => (
            <Checkbox
                key={filter.id}
                onChange={() => toggleFilter(filter.id)}
                checked={isOn(filter.id)}
            >
                {filter.label}
            </Checkbox>
        ));

        return (
            <div className="aji-checkbox-container">
                {checkboxes}
            </div>
        );
    }, [toggleFilter, isOn]);

    const renderFilterTagPanel = useCallback(() => {
        const filesForPanel = getFilteredFiles({ skipTagFilter: true });

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

        const excludedTags = new Set(Array.isArray(state.filterTags) ? state.filterTags : []);

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
            setTagFilters(tags.slice());
        };

        return (
            <FilterPanel
                title="Filter Tags"
                items={items}
                onToggle={toggleTagFilterSelection}
                onSelectAll={resetTagFilters}
                onDeselectAll={deselectAllTags}
                className="filter-type-panel"
            />
        );
    }, [getFilteredFiles, state.filterTags, toggleTagFilterSelection, resetTagFilters, setTagFilters]);

    const renderSortHeader = useCallback(() => {
        let sortOptions = (ClientConstant as any).SORT_OPTIONS.slice();

        if (getMode() !== MODE_EXPLORER) {
            sortOptions.push(BY_FOLDER);
        }

        return (<div className="sort-header-container container">
            <SortHeader sortOptions={sortOptions} selected={state.sortOrder}
                isSortAsc={state.isSortAsc}
                onChange={onSortChange}
                className=""
                options={sortOptions}
            />
        </div>);
    }, [getMode, state.sortOrder, state.isSortAsc, onSortChange]);

    const renderFilterControls = useCallback(() => {
        return (
            <>
                <div className="explorer-filter-panel container">
                    <div className='small-wrapper'>
                        <div className="explorer-filter-panel__row explorer-filter-panel__row--controls">
                            {renderPageRangeSilder()}
                            {renderCheckboxPanel()}
                        </div>
                    </div>
                </div>
            </>
        );
    }, [renderPageRangeSilder, renderCheckboxPanel]);

    const getLinkToEhentai = useCallback(() => {
        let searchable: any = tagRef.current || authorRef.current;
        const isSearchMode = getMode() === MODE_SEARCH;
        if (isSearchMode) {
            searchable = getTextFromQuery();
        }

        if (searchable) {
            return <LinkToEHentai searchable={searchable} text={getTitle()} />;
        }
        return null;
    }, [getMode, getTextFromQuery, getTitle]);

    const getExplorerToolbar = useCallback((filteredFiles: string[], filteredVideos: string[]) => {
        const mode = getMode();
        const info = createInfoObject();

        const isExplorer = mode === MODE_EXPLORER && getPathFromQuery();
        const isTag = mode === MODE_TAG;
        const isAuthor = mode == MODE_AUTHOR;
        const url = clientUtil.getSearhLink(getTextFromQuery());

        const isInfoMode = !isLackInfoMode();

        const warning = isLackInfoMode() && (
            <NoScanAlertArea filePath={getTextFromQuery()}></NoScanAlertArea>
        );

        let topButtons = (
            <div className="top-button-gropus row">
                <div className="col-6 col-md-4"> {renderToggleFolferThumbNailButton()} </div>
                <div className="col-6 col-md-4"> {renderToggleThumbNailButton()} </div>

                {isInfoMode && <div className="col-6 col-md-4"> {renderChartButton()} </div>}
                {isExplorer && isInfoMode &&
                    <div className="col-6 col-md-4"> {renderLevelButton()} </div>}
                {isExplorer &&
                    <div className="col-6 col-md-4"> {renderPregenerateButton()} </div>}
                {
                    (isTag || isAuthor) &&
                    <div className="col-6 col-md-4">
                        <Link target="_blank" className="exp-top-button" to={url} >
                            <span className="fab fa-searchengin" />
                            <span>Search by Text </span>
                        </Link>
                    </div>
                }
                {isExplorer && <div className="col-6 col-md-4"> {getBookModeLink()} </div>}
            </div>);

        const breadcrumb = isExplorer && (<div className="row">
            <Breadcrumb sep={globalContext.file_path_sep}
                server_os={globalContext.server_os}
                path={getPathFromQuery()} className="col-12" />
        </div>);

        return (<div className="container explorer-top-bar-container">
            {breadcrumb}
            {warning}
            <FileCountPanel filteredFiles={filteredFiles} filteredVideos={filteredVideos} info={info} />
            {topButtons}
        </div>);
    }, [getMode, getPathFromQuery, getTextFromQuery, isLackInfoMode, renderToggleFolferThumbNailButton, renderToggleThumbNailButton, renderChartButton, renderLevelButton, renderPregenerateButton, getBookModeLink, globalContext, createInfoObject]);

    const renderFileList = useCallback((filteredFiles: string[], filteredVideos: string[]) => {
        const { sortOrder, isSortAsc, showFolderThumbnail } = state;
        let dirs = dirsRef.current;
        let videos = filteredVideos;
        let files = filteredFiles;
        const info = createInfoObject();

        try {
            files = ExplorerUtil.sortFiles(info, files, sortOrder, isSortAsc);
        } catch (e) {
            console.error(e);
        }

        const isEmpty = [dirs, files, videos, musicFilesRef.current, imageFilesRef.current].every(_.isEmpty);
        if (isEmpty) {
            if (!resRef.current) {
                return (<CenterSpinner text={getTextFromQuery()} />);
            } else {
                const str = getMode() === MODE_EXPLORER ? "This folder is empty" : "Empty Result";
                return (
                    <div>
                        {renderFilterControls()}
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

                let thumbnailurl = getFileUrl(dirThumbnailMapRef.current[item]);
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
                const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item, info);
                return (
                    <ThumbnailPopup filePath={item} key={item}>
                        <Link to={toUrl}>{result}</Link>
                    </ThumbnailPopup>
                );
            });
        }

        // separate av from others
        const groupByVideoType = _.groupBy(videos, item => {
            const text = getBaseName(item);
            const temp = parse(item);

            if (util.isAv(text)) {
                return "av";
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
                const result = getOneLineListItem(<i className="far fa-file-video"></i>, text, item, info);
                return (
                    <Link target="_blank" to={toUrl} key={item}>{result}</Link>
                );
            });
            return <ItemsContainer key={key} className="video-list" items={videoItems} />;
        });

        files = getFileInPage(files);

        let zipfileItems: ReactNode[] | ReactNode;
        if (sortOrder === BY_FOLDER || sortOrder === BY_FOLDER &&
            (getMode() === MODE_AUTHOR || getMode() === MODE_TAG || getMode() === MODE_SEARCH)) {

            zipfileItems = <FileGroupZipPanel files={files} isSortAsc={state.isSortAsc} info={info} />;
        } else {
            zipfileItems = files.map(fp => renderSingleZipItem(fp));
        }

        const rowCn = state.noThumbnail ? "file-list" : "row";

        return (
            <div className={"explorer-container"}>
                {!showFolderThumbnail && <ItemsContainer items={dirItems} neverCollapse={getMode() === MODE_EXPLORER} />}
                {showFolderThumbnail &&
                    <div className={"file-grid container"}>
                        <div className={"row"}>
                            {dirItems}
                        </div>
                    </div>
                }

                <SimpleFileListPanel musicFiles={musicFilesRef.current} imageFiles={imageFilesRef.current} info={info} />

                {videoDivGroup}
                {renderPagination(filteredFiles, filteredVideos)}
                {renderFilterControls()}
                {(Array.isArray(zipfileItems) ? zipfileItems.length > 0 : !!zipfileItems) && renderSortHeader()}
                <div className={"file-grid container"}>
                    <div className={rowCn}>
                        {zipfileItems}
                    </div>
                </div>
            </div>
        );
    }, [state, getTextFromQuery, getMode, renderFilterControls, getFileInPage, renderSingleZipItem, renderPagination, renderSortHeader, createInfoObject]);

    // Main render
    setWebTitle();

    if (isFailedLoading()) {
        return <ErrorPage res={resRef.current} />;
    }

    const filteredFiles = getFilteredFiles();
    const filteredVideos = getFilteredVideos();

    const cn = classNames("explorer-container-out", getMode().replace(" ", "_"));

    return (<div className={cn} >
        {getLinkToEhentai()}
        {getExplorerToolbar(filteredFiles, filteredVideos)}
        {renderFileList(filteredFiles, filteredVideos)}
        {renderPagination(filteredFiles, filteredVideos)}
    </div>
    );
};

export default ExplorerPage;
