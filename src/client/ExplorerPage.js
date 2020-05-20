// @flow
import React, { Component } from 'react';
import _ from "underscore";
import './style/Explorer.scss';
import PropTypes from 'prop-types';
import LoadingImage from './LoadingImage';
import Sender from './Sender';
import { Link } from 'react-router-dom';

const userConfig = require('@config/user-config');
import ErrorPage from './ErrorPage';
import Pagination from 'rc-pagination';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import CenterSpinner from './subcomponent/CenterSpinner';
const util = require("@common/util");
const filesizeUitl = require('filesize');
const queryString = require('query-string');
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
import SortHeader from './subcomponent/SortHeader';
import Breadcrumb from './subcomponent/Breadcrumb';
import Checkbox from './subcomponent/Checkbox';
const nameParser = require('@name-parser');
const classNames = require('classnames');
const Constant = require("@common/constant");
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping } = clientUtil;
const { isVideo, isCompress } = util;
const sortUtil = require("../common/sortUtil");
const AdminUtil = require("./AdminUtil");


const { SORT_FROM_LATEST, 
        SORT_FROM_EARLY,
        SORT_BY_FOLDER,
        SORT_BY_FILENAME_UP,
        SORT_BY_FILENAME_DOWN,
        SORT_FROM_SMALL_FILE_SIZE,
        SORT_FROM_BIG_FILE_SIZE,
        SORT_FROM_SMALL_PAGE_SIZE,
        SORT_FROM_BIG_PAGE_SIZE,
        SORT_FROM_SMALL_PAGE_NUMBER,
        SORT_FROM_BIG_PAGE_NUMBER,
        SORT_RANDOMLY } =  Constant;

const { MODE_TAG,
        MODE_HOME,
        MODE_AUTHOR,
        MODE_SEARCH,
        MODE_EXPLORER} = Constant;

const GOOD_STANDARD = 2;

function parse(str){
    return nameParser.parse(getBaseName(str));
}

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = this.getInitState();
        this.failedTimes = 0;
        this.files = [];
    }

    getNumPerPage(){
        return this.state.noThumbnail? 40 :  getPerPageItemNumber();
    }

    getInitState(reset){
        const parsed = reset? {} : queryString.parse(location.hash);
        const pageIndex = parseInt(parsed.pageIndex) || 1;
        const isRecursive = !!(parsed.isRecursive === "true");
        const sortOrder = parsed.sortOrder || SORT_FROM_LATEST;
        const showVideo = !!(parsed.showVideo === "true");
        
        return {
            anchorSideMenu: false,
            pageIndex,
            isRecursive,
            sortOrder,
            showVideo,
            filterByGoodAuthorName: parsed.filterByGoodAuthorName === "true",
            filterByFirstTime: parsed.filterByFirstTime === "true",
            filterByHasMusic: parsed.filterByHasMusic === "true",
            filterByOversizeImage: parsed.filterByOversizeImage === "true",
            filterText: parsed.filterText || "",
            noThumbnail: parsed.noThumbnail === "true"
        }
    }

    setStateAndSetHash(state, callback){
        const obj = Object.assign({}, this.state, state);
        location.hash = queryString.stringify(obj);
        this.setState(state, callback);
    }

    handlePageChange(index){
        if(window.event && window.event.ctrlKey){
            return;
        }
        this.setStateAndSetHash({ pageIndex: index});
    }

    next(){
        if(this.pagination && this.pagination.hasNext()){
            let next = this.state.pageIndex+1;
            this.handlePageChange(next);
        }
    }

    prev(){
        if(this.pagination && this.pagination.hasPrev()){
            let next = this.state.pageIndex-1;
            this.handlePageChange(next);
        }
    }

    getPathFromQuery(props){
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["p"] ||  "";
    }

    getSearchTextFromQuery(props){
        // https://en.wikipedia.org/wiki/URL
        // e.g ?s=apple
        const _props = props || this.props;
        if(this.getMode(_props) === MODE_SEARCH){
            let str =  _props.location.search || _props.location.pathname;
            str = str.replace("/search/?", "")
            return queryString.parse(str)["s"] ||  "";
        }
    }

    getAuthorFromQuery(props){
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["a"] || "";
    }

    getTagFromQuery(props){
        const _props = props || this.props;
        return queryString.parse(_props.location.search)["t"] ||  "";
    }

    getTextFromQuery(props) {
        const _props = props || this.props;
        return this.getTagFromQuery(_props) || 
               this.getAuthorFromQuery(_props)||
               this.getSearchTextFromQuery(_props) ||
               this.getPathFromQuery(_props);
    }

    getMode(props){
        const _props = props || this.props;
        const pathname = _props.location.pathname;
        if(pathname.includes("/tag/")){
            return MODE_TAG;
        } else if(pathname.includes("/author/")) {
            return MODE_AUTHOR;
        } else if(pathname.includes("/explorer/")) {
            return MODE_EXPLORER;
        } else if(pathname.includes("/search/")) {
            return MODE_SEARCH;
        } else {
            return MODE_HOME;
        }
    }

    componentWillReceiveProps(nextProps){
        if(nextProps.filterText){
            this.handlePageChange(1);

            this.setState({
                filterText: nextProps.filterText
            })
        }
    }

    requestHomePagePathes() {
        Sender.post("/api/homePagePath", { }, res => {
            this.handleRes(res);
        });
    }
    

    askServer(){
        if(this.getMode() === MODE_HOME){
            this.requestHomePagePathes();
        } else{
            const hash = this.getTextFromQuery();
            if (hash && this.loadedHash !== hash && this.failedTimes < 3) {
                if(this.getMode() === MODE_TAG){
                    this.requestSearch();
                } else if(this.getMode() === MODE_AUTHOR){
                    this.requestSearch();
                } else if (this.getMode() === MODE_SEARCH){
                    this.requestTextSearch();
                } else {
                    this.requestLsDir();
                }
            }
        }
    }

    componentDidMount() {
        this.askServer();

        this.bindUserInteraction();

        Sender.get('/api/getGoodAuthorNames', res =>{
            this.setState({
                goodAuthors: res.goodAuthors,
                otherAuthors: res.otherAuthors
            })
        });
    }

    bindUserInteraction(){
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    componentWillUnmount(){
        document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    }
    
    componentDidUpdate(prevProps, prevState) {
        //when path changes, does not show previous path's content 
        const prevMode = this.getMode(prevProps);
        const prevHash = this.getTextFromQuery(prevProps);
        const differentMode = this.getMode() !== prevMode;
        const sameMode = !differentMode;
        const pathChanged = !!(sameMode && this.getTextFromQuery() !== prevHash );
        if(differentMode || pathChanged ){
            this.loadedHash = "";
            this.videoFiles = []
            this.files = [];
            this.dirs = [];
            this.tag = "";
            this.author = "";
            this.fileInfos = {};
            this.thumbnails = {};
            this.res = "";
            //init state
            this.setStateAndSetHash(this.getInitState(true));
            this.askServer();
        }
    }

    handleRes(res){
        if (!res.failed) {
            let {dirs, files, path, tag, author, fileInfos, thumbnails, zipInfo} = res;
            this.loadedHash = this.getTextFromQuery();
            files = files || [];
            this.videoFiles = files.filter(isVideo) || []
            this.files = files.filter(isCompress) || [];
            this.dirs = dirs || [];
            this.tag = tag || "";
            this.author = author || "";
            this.fileInfos = fileInfos || {};
            this.thumbnails = thumbnails || {};
            this.zipInfo = zipInfo || {};
            this.res = res;

            if(this.videoFiles.length > 0){
                this.setStateAndSetHash({
                    showVideo: true
                });
            }

            //check pageindex
            const availableFiles = this.getFileInPage(this.getFilteredFiles());

            if(availableFiles.length === 0){
                //this will set state
                this.handlePageChange(1);
            }else{
                this.forceUpdate();
            }
        }else{
            this.res = res;
            this.failedTimes++;
            this.forceUpdate();
        }
    }

    requestTextSearch() {
        Sender.post("/api/search", { text: this.getSearchTextFromQuery(),  mode: this.getMode()}, res => {
            this.handleRes(res);
        });
    }

    handleKeyDown(event) {
        //this cause input wont work 
        if(isSearchInputTextTyping()){
            return;
        }

        const key = event.key.toLowerCase();
        if (key === "arrowright" || key === "d" || key === "l") {
          this.next();
          event.preventDefault();
        } else if (key === "arrowleft" || key === "a" || key === "j") {
          this.prev();
          event.preventDefault();
        }
    }

    requestSearch() {
        Sender.post("/api/search", { text: this.getTextFromQuery(),
                                    mode: this.getMode()}, res => {
            this.handleRes(res);
        });
    }
    
    requestLsDir() {
        Sender.lsDir({ dir: this.getTextFromQuery(), isRecursive: this.state.isRecursive }, res => {
            this.handleRes(res);
        });
    }


    //comes from file db.
    //may not be reliable
    getFileSize(e){
        return (this.fileInfos[e] && this.fileInfos[e].size) || 0;
    }

    getPageNum(fp){
       return +(this.zipInfo[fp] && this.zipInfo[fp].pageNum) || 0;
    }

    hasZipInfo(fp){
       return !!this.zipInfo[fp];
    }

    //comes from zipInfo libray, may not be reliable
    //because sometimes, filename dont chane but the size change 
    getTotalImgSize(fp){
       return +(this.zipInfo[fp] && this.zipInfo[fp].totalImgSize) || 0;
    }

    //may not be reliable
    getPageAvgSize(e, forDisplay){
        const pageNum = this.getPageNum(e);
        if(pageNum === 0){
            //one for display
            //one for sort 
            return forDisplay? 0 : -Infinity;
        }

        //choose the min
        //but can not be 0
        let total;

        if(this.getFileSize(e) === 0){
            total = this.getTotalImgSize(e);
        }else{
            total = Math.min(this.getFileSize(e), this.getTotalImgSize(e))
        }

        return total/pageNum;
    }

    getMusicNum(fp){
        return +(this.zipInfo[fp] && this.zipInfo[fp].musicNum) || 0;
    }
    
    getFilteredFiles(){
        let files = this.files || [];
        const goodSet = this.state.goodAuthors;
        const otherSet = this.state.otherAuthors;
        const {filterByGoodAuthorName, filterByOversizeImage, filterByFirstTime, filterByHasMusic} = this.state;

        if(filterByGoodAuthorName && goodSet && otherSet){
            files = files.filter(e => {
                const temp = parse(e);
                if(temp && temp.author && goodSet[temp.author] && goodSet[temp.author] > GOOD_STANDARD){
                    return e;
                }
            })
        }

        if(filterByOversizeImage){
           files = files.filter(e => {
               if(this.zipInfo[e]){
                   if(this.getPageAvgSize(e)/1024/1024 > userConfig.oversized_image_size){
                       return e;
                   }
               }
           })
        }

        if(filterByFirstTime && goodSet && otherSet){
            files = files.filter(e => {
                const temp = parse(e);
                if(temp && temp.author && ((goodSet[temp.author]||0) + (otherSet[temp.author]||0)) <= 1){
                    
                    return e;
                }
            })
        }

        if(filterByHasMusic){
            files = files.filter(e => {
                if(this.zipInfo[e]){
                    const musicNum =  this.zipInfo[e].musicNum || 0;
                    if(musicNum > 0){
                        return e;
                    }
                }
            })
        }

        const filterText = this.state.filterText && this.state.filterText.toLowerCase();
        if(filterText){
            return files.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }else{
            return files;
        }
    }

    getFilteredVideos(){
        if(!this.state.showVideo){
            return [];
        }

        const {filterByGoodAuthorName, filterByOversizeImage, filterByFirstTime, filterByHasMusic} = this.state;
        let videoFiles;
        if(filterByGoodAuthorName || filterByOversizeImage || filterByFirstTime || filterByHasMusic){
            videoFiles = [];
        }else{
            videoFiles =  this.videoFiles || []
        }

        const filterText = this.state.filterText && this.state.filterText.toLowerCase();
        if(filterText){
            return videoFiles.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }else{
            return videoFiles;
        }
    }

    getFileInPage(files){
        return files.slice((this.state.pageIndex-1) * this.getNumPerPage(), (this.state.pageIndex) * this.getNumPerPage());
    }

    sortFiles(files, sortOrder){
        //-------sort algo
        const byFn = (a, b) => {
            const ap = getBaseName(a);
            const bp = getBaseName(b);
            return ap.localeCompare(bp);
        }

        if(sortOrder  === SORT_BY_FILENAME_UP || sortOrder === SORT_BY_FILENAME_DOWN){
            files.sort((a, b) => {
                return byFn(a, b);
            });

            if(sortOrder === SORT_BY_FILENAME_DOWN){
                files.reverse();
            }
        }else if(sortOrder === SORT_BY_FOLDER){
            files = _.sortBy(files, e => {
                const dir =  getDir(e);
                return dir;
            });
        }else if (sortOrder === SORT_FROM_LATEST ||  sortOrder === SORT_FROM_EARLY){
            const ifFromEarly = sortOrder === SORT_FROM_EARLY;
            const ifOnlyBymTime = this.getMode() === MODE_EXPLORER;
            files = sortUtil.sort_file_by_time(files, this.fileInfos, getBaseName, ifFromEarly, ifOnlyBymTime);
        } else if (sortOrder === SORT_FROM_BIG_FILE_SIZE || sortOrder === SORT_FROM_SMALL_FILE_SIZE){
            files = _.sortBy(files, e => {
                const size =  this.getFileSize(e);
                return sortOrder === SORT_FROM_SMALL_FILE_SIZE? size: -size;
            });
        } else if (sortOrder === SORT_FROM_SMALL_PAGE_SIZE || sortOrder === SORT_FROM_BIG_PAGE_SIZE){
            files = _.sortBy(files, e => {
                const size =  this.getPageAvgSize(e);
                return sortOrder === SORT_FROM_SMALL_PAGE_SIZE? size: -size;
            });
        } else if (sortOrder === SORT_FROM_SMALL_PAGE_NUMBER || sortOrder === SORT_FROM_BIG_PAGE_NUMBER){
            files = _.sortBy(files, e => {
                const size =  this.getPageNum(e);
                return sortOrder === SORT_FROM_SMALL_PAGE_NUMBER? size: -size;
            });
        } else if (sortOrder.includes(SORT_RANDOMLY)){
                files = _.shuffle(files);
        }

        return files;
    }

    getOneLineListItem(icon, fileName, filePath){
        return (
        <li className="explorer-one-line-list-item" key={fileName} title={filePath}>
        {icon}
        <span className="explorer-one-line-list-item-text">{fileName}</span>
        </li>);
    }

    renderFileList() {
        const { sortOrder } = this.state;
        let dirs = this.dirs||[];
        let videos = this.getFilteredVideos();
        let files = this.getFilteredFiles();

        try {
            files = this.sortFiles(files, sortOrder);
        }catch(e){
            console.error(e);
        }
        
        if (_.isEmpty(dirs) && _.isEmpty(files) && _.isEmpty(videos)) {
            if(!this.res){
                return (<CenterSpinner text={this.getTextFromQuery()}/>);
            }else{
                return (<div className="one-book-nothing-available">
                            <div className="alert alert-secondary" role="alert">    Empty Folder </div>
                        </div>);
            }
        } 
        
        const dirItems = dirs.map((item) =>  {
            const toUrl = clientUtil.getExplorerLink(item);
            const text = this.getMode() === MODE_HOME ? item: getBaseName(item);
            const result =  this.getOneLineListItem(<i className="far fa-folder"></i>, text, item);
            return  <Link to={toUrl}  key={item}>{result}</Link>;
        });

        let videoItems = videos.map((item) =>  {
            const toUrl = clientUtil.getVideoPlayerLink(item);
            const text = getBaseName(item);
            const result = this.getOneLineListItem(<i className="far fa-file-video"></i>, text, item);
            return  <Link to={toUrl}  key={item}>{result}</Link>;
        });

        //! !todo if the file is already an image file
        files = this.getFileInPage(files);

        //better tooltip to show file size 
        //and tag
        let breadcrumbCount = 0;
        const zipfileItems = files.map((item, index) => {
            const text = getBaseName(item);
            const toUrl =  clientUtil.getOneBookLink(item);

            const fileSize = this.getFileSize(item);
            const fileSizeStr = fileSize && filesizeUitl(fileSize, {base: 2});

            const avgSize = this.getPageAvgSize(item, "for-dispaly");
            const avgSizeStr = avgSize && filesizeUitl(avgSize, {base: 2});

            let seperator;

            if(sortOrder === SORT_BY_FOLDER && 
                (this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH )){
                const prev = files[index - 1];
                if(!prev || getDir(prev) !== getDir(item)){
                    seperator = (<div className="col-12"  key={item+"---seperator"}> 
                                 <Breadcrumb  path={getDir(item)} className={breadcrumbCount > 0? "not-first-breadcrumb folder-seperator": "folder-seperator" }/>
                                 </div>);
                    breadcrumbCount++;
                }
            }

            let zipItem;

            if(this.state.noThumbnail){
                zipItem = (<Link to={toUrl}  key={item} className={""}>
                        {this.getOneLineListItem(<i className="fas fa-book"></i>, text, item)}
                        </Link>)
            }else{
                const fl = text.length;
                const cellTitleCn = classNames("file-cell-title",{
                    "f-s-12": fl > 30,
                    "f-s-14": fl <= 30
                });

                const hasZipInfo = this.hasZipInfo(item);
                const musicNum = this.getMusicNum(item);
                const hasMusic = musicNum > 0;

                const fileInfoRowCn = classNames("file-info-row", {
                    "less-padding": hasMusic
                })

                zipItem = (
                <div key={item} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
                    <div className="file-cell">
                        <Link  target="_blank" to={toUrl}  key={item} className={"file-cell-inner"}>
                            <center className={cellTitleCn} title={text}>{text}</center>
                            <LoadingImage 
                                    isThumbnail 
                                    className={"file-cell-thumbnail"} 
                                    title={item} fileName={item}   
                                    url={this.thumbnails[item]}
                                    onReceiveUrl={url => {this.thumbnails[item] = url;}} 
                                    />
                        </Link>
                        <div className={fileInfoRowCn}>
                            <span title="file size">{fileSizeStr}</span>
                            {hasZipInfo  &&  <span>{`${this.getPageNum(item)} pages`}</span>}
                            {hasMusic    &&  <span>{`${musicNum} songs`}</span>}
                            {hasZipInfo  &&  <span title="average img size"> {avgSizeStr} </span>}
                        </div>
                        <FileChangeToolbar hasMusic={hasMusic} className="explorer-file-change-toolbar" file={item} />
                    </div>
                </div>);
            }
            
            return (<React.Fragment  key={item}>
                    {seperator}
                    {zipItem}
                    </React.Fragment>);
        });

        const rowCn = this.state.noThumbnail? "file-list" : "row";

        return (
            <div className={"explorer-container"}>
                <ul className={"dir-list container"}>
                    {dirItems}
                </ul>
                <ul className={"dir-list container"}>
                    {videoItems}
                </ul>
                {this.renderPagination()}
                {this.renderSortHeader()}
                <div className={"file-grid container"}>
                    <div className={rowCn}>
                        {zipfileItems}
                    </div>
                </div>
            </div>
        );
    }
    
    isFailedLoading(){
        return this.res && this.res.failed;
    }

    toggleRecursively(){
        this.videoFiles = []
        this.files = [];
        this.dirs = [];
        this.res = null;

        this.setStateAndSetHash({
            pageIndex: 1,
            isRecursive: !this.state.isRecursive
        }, ()=>{
            this.failedTimes = 0;
            this.requestLsDir();
        })
    }

    toggleThumbNail(){
        this.setStateAndSetHash({
            noThumbnail: !this.state.noThumbnail
        })
    }

    toggleShowVideo(){
        this.setStateAndSetHash({
            showVideo: !this.state.showVideo
        })
    }

    renderToggleThumbNailButton(){
        const text2 = this.state.noThumbnail? "Show Thumbnail" : "File Name Only";
        return (
           <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={this.toggleThumbNail.bind(this)}>
                <span className="fas fa-book" /> <span>{text2} </span> 
            </span>
        );
    }

    renderShowVideoButton(){
        if(this.videoFiles && this.videoFiles.length > 0){
            const text2 = this.state.showVideo? "hide video" : "show video";
            return (
                <span className="show-video-button exp-top-button" onClick={this.toggleShowVideo.bind(this)}> 
                <span className="fas fa-video" />
                <span> {text2} </span>
                </span>
            );
        }
    }

    renderLevelButton(){
     const text = this.state.isRecursive? "Show only one level" : "Show subfolder's files";
     return (
        <span className="recursive-button exp-top-button" onClick={this.toggleRecursively.bind(this)}> 
        <span className="fas fa-glasses" />
        <span> {text} </span>
        </span>
     );
    }

    renderToggleMenuButton(){
        const text = "toggle side menu"
        return (
           <span key="toggle-side-menu-button" className="toggle-side-menu-button exp-top-button" onClick={this.toggleSideMenu.bind(this)}> 
           <span className="fas fa-ellipsis-h" />
           <span> {text} </span>
           </span>
        );
    }

    renderChartButton(){
        if(this.getMode() === MODE_EXPLORER){
            return (<Link target="_blank" className="exp-top-button" to={'/chart/?p='+this.getTextFromQuery()}>  
                         <span className="fas fa-chart-line" /> 
                         <span> chart </span>
                    </Link>)
        }
    }

    renderChartButton(){
        if(this.getMode() === MODE_EXPLORER){
            const text = "generate thumbnail"
            return (
               <span key="thumbnail-button" className="thumbnail-button exp-top-button" onClick={()=>AdminUtil.askPregenerate(this.getPathFromQuery())}> 
               <span className="fas fa-tools" />
               <span> {text} </span>
               </span>
            );
        }
    }

    getExplorerToolbar(){
        const mode = this.getMode();
        if(mode === MODE_EXPLORER && this.getPathFromQuery()){
            const totalSize = this.getAllFileSize();
            let topButtons = (
            <div className="top-button-gropus row">
                    <div className="file-count col-6 col-md-4"><i className="fas fa-file-archive"/>{this.getFilteredFiles().length + " compressed files"} </div>
                    <div className="file-count col-6 col-md-4"><i className="fas fa-film"/>{this.getFilteredVideos().length + " video files"} </div>
                    <div className="file-count col-6 col-md-4"><i className="fas fa-hdd"/>{filesizeUitl(totalSize, {base: 2})} </div>
                    <div className="col-6 col-md-4"> {this.renderToggleThumbNailButton()} </div>
                    <div className="col-6 col-md-4"> {this.renderLevelButton()} </div>
                    <div className="col-6 col-md-4"> {this.renderShowVideoButton()} </div>
                    <div className="col-6 col-md-4 " > {this.renderToggleMenuButton()} </div>  
                    <div className="col-6 col-md-4"> {this.renderChartButton()} </div>
            </div>);

            return (<div className="container explorer-top-bar-container">
                        <div className="row">
                            <Breadcrumb path={this.getPathFromQuery()} className="col-12" /> 
                        </div>
                        {topButtons}
                    </div>);
        }
    }

    getTitle(){
        const mode = this.getMode();
        const fn = " (" + (this.files||[]).length + ")";

        if(mode === MODE_HOME){
            return "";
        }else if(this.tag && mode === MODE_TAG) {
            return "Tag: " + this.tag + fn;
        } else if(this.author && mode === MODE_AUTHOR) {
            return "Author: " + this.author + fn;
        } else if(mode === MODE_SEARCH){
            return "Search Result: " + this.getTextFromQuery() + fn;
        }
    }

    getLinkToEhentai(){
        let searchable = this.tag || this.author;
        const isSearchMode = this.getMode() === MODE_SEARCH;
        if(isSearchMode){
            searchable = this.getTextFromQuery();
        }

        if(searchable){
            const link = "https://exhentai.org/?f_search=" + searchable;
            const title = "Search '"  + searchable +  "' in Exhentai";

            let btn;
            if(this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH){
                btn = [this.renderToggleThumbNailButton(), this.renderToggleMenuButton()] ;
            }

            const videoButuon = isSearchMode &&  this.renderShowVideoButton();

            return (<center className={"location-title"}>
                        <a className="explorer-external-link" target="_blank" href={link} title={title}>{this.getTitle()} </a>
                        {btn}
                        {videoButuon}
                    </center>);
        } 
    }

    renderPagination(){
        if(this.getMode() === MODE_HOME){
            return;
        }
        const fileLength = this.getFilteredFiles().length;
        if(fileLength === 0){
          return;
        }
    
        const that =this;
        return (<Pagination ref={ref => this.pagination = ref}
                            current={this.state.pageIndex}  
                            pageSize={this.getNumPerPage()}
                            showQuickJumper={{goButton: true}}
                            total={fileLength} 
                            itemRender={(item, type) =>{
                                if(type === "page"){
                                    return  <div>{item}</div>;
                                }else if(type === "prev" || type === "next"){
                                    return <a className="rc-pagination-item-link" />
                                }
                            }}
                            onChange={this.handlePageChange.bind(this)} 
                            />);
    }

    setWebTitle(){
        const mode = this.getMode();
        if(mode === MODE_HOME){
            document.title = "ShiguReader";
        }else{
            document.title = this.getTextFromQuery()|| "ShiguReader";
        }
    }

    onSortChange(e){
        this.setStateAndSetHash({sortOrder: e})
    }

    toggleSideMenu(){
        this.setState({anchorSideMenu: !this.state.anchorSideMenu})
    }

    setFilterText(text){
        this.setStateAndSetHash({filterText: text, pageIndex: 1});
    }

    toggleGoodAuthor(){
        this.setStateAndSetHash({
            filterByGoodAuthorName: !this.state.filterByGoodAuthorName
        });
    };

    toggleOversizeImage(){
        this.setStateAndSetHash({
            filterByOversizeImage: !this.state.filterByOversizeImage
        });
    };

    toggleFirstTime(){
        this.setStateAndSetHash({
            filterByFirstTime: !this.state.filterByFirstTime
        });
    }

    toggleHasMusic(){
        this.setStateAndSetHash({
            filterByHasMusic: !this.state.filterByHasMusic
        });
    }

    getAllFileSize(){
        let files = this.getFilteredFiles();
        files = files.concat(this.getFilteredVideos())
        let totalSize = 0;
        files.forEach(e => {
            if(this.fileInfos[e]){
                totalSize += this.fileInfos[e].size;
            }
        });
        return totalSize;
    }

    renderSideMenu(){
        const tag2Freq = {};
        const files = this.getFilteredFiles();
        files.forEach(e => {
            const result = parse(e);
            let tags = (result && result.tags)||[];

            tags.forEach(t => {
                if(t.length > 1){
                    tag2Freq[t] = tag2Freq[t] || 0;
                    tag2Freq[t]++;
                }
            })
        });

        let tags = _.keys(tag2Freq);

       tags.sort((a, b) => {
            return tag2Freq[b] - tag2Freq[a];
        })

        const tagInfos = tags.slice(0, 30).map(t => {
            return (<div className="side-menu-single-tag col-3" onClick={() => this.setFilterText(t)} key={t}>
                        {t}<span>({tag2Freq[t]})</span> 
                    </div>);
        });


        const showAll = (
        <div className="side-menu-single-tag col-3" onClick={() => this.setFilterText("")} key={"side-menu-single-tag-all"}>
            All
        </div>);

        tagInfos.unshift(showAll);
        const tagContainer = (<div className="exp-tag-container row">{tagInfos} </div>);

        if(this.getMode() !== MODE_HOME){
            const cn = classNames("side-menu container", {
                anchorSideMenu: this.state.anchorSideMenu
            });

       
            return (<div className={cn}>
                    <div className="side-menu-radio-title"> Special Filter </div>
                    {this.renderSpecialFilter()}
                    {tagContainer}
                </div>)
        }
    }

    renderSortHeader(){
        const sortOptions = Constant.SORT_OPTIONS;

        let radiogroup;

        if(this.getMode() !== MODE_EXPLORER){
            const RADIO_SORT_OPTIONS  = SORT_BY_FOLDER;

            radiogroup = (<RadioButtonGroup  
            className="sort-radio-button-group"
            checked={RADIO_SORT_OPTIONS.indexOf(this.state.sortOrder)} 
            options={RADIO_SORT_OPTIONS} name="explorer-sort-order" 
            onChange={this.onSortChange.bind(this)}/>)
        }

        const cn = classNames({
            "less-space": !!radiogroup
        })

       return (<div className="flex-center-display-container sort-header-container container"> 
            <SortHeader className={cn} options={sortOptions} value={this.state.sortOrder} onChange={this.onSortChange.bind(this)} />
            {radiogroup}
            </div>);
    }

    renderSpecialFilter(){
        //no one pay me, I am not going to improve the ui
        let checkbox;
        if(this.state.goodAuthors){
            checkbox = (<Checkbox  onChange={this.toggleGoodAuthor.bind(this)} 
                                    checked={this.state.filterByGoodAuthorName} 
                                  title={`need to found more than ${GOOD_STANDARD} times in good folder`}>
                             By good_folder_root 
                        </Checkbox> );       
        }   

        const st2 = `image size bigger than ${userConfig.oversized_image_size} MB` ;
        let checkbox2 = (<Checkbox  onChange={this.toggleOversizeImage.bind(this)} checked={this.state.filterByOversizeImage}>
                                   {st2}   
                            </Checkbox> ); 

        const st3 = `first time` ;
        let checkbox3 = (<Checkbox  onChange={this.toggleFirstTime.bind(this)} checked={this.state.filterByFirstTime}>
                                   {st3}   
                            </Checkbox> ); 

        const st4 = `has music` ;
        let checkbox4 = (<Checkbox  onChange={this.toggleHasMusic.bind(this)} checked={this.state.filterByHasMusic}>
                                {st4}   
                            </Checkbox> ); 
        return (
        <div className="speical-checkbox-container">
            {checkbox}
            {checkbox2}
            {checkbox3}
            {checkbox4}
        </div>);
    }

    render() {
        this.setWebTitle();

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        }

        const cn = classNames("explorer-container-out", this.getMode().replace(" ", "_"));

        return (<div className={cn} >
            {this.getLinkToEhentai()}
            {this.getExplorerToolbar()}
            {this.renderSideMenu()}
            {this.renderFileList()}
            {this.renderPagination()}
            </div>
        );
    }
}

ExplorerPage.propTypes = {
    dirs: PropTypes.array,
    files: PropTypes.array,
    openBookFunc: PropTypes.func,
    openDirFunc: PropTypes.func,
    filterText: PropTypes.string
};
