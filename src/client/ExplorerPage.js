// @flow
import React, { Component } from 'react';
import _ from "underscore";
import './style/Explorer.scss';
import PropTypes from 'prop-types';
import LoadingImage from './LoadingImage';
import Sender from './Sender';
import { Link } from 'react-router-dom';

const userConfig = require('../user-config');
import ErrorPage from './ErrorPage';
import Pagination from 'rc-pagination';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import CenterSpinner from './subcomponent/CenterSpinner';
const util = require("../util");
const filesizeUitl = require('filesize');
const queryString = require('query-string');
const stringHash = util.stringHash;
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
import Breadcrumb from './subcomponent/Breadcrumb';

const Constant = require("../constant");

const { SORT_BY_DATE, 
        SORT_BY_DATE_REVERSE,
        SORT_BY_FOLDER,
        SORT_BY_FILENAME,
        SORT_FROM_SMALL,
        SORT_FROM_BIG,
        SORT_RANDOMLY } =  Constant;

const { MODE_TAG,
        MODE_HOME,
        MODE_AUTHOR,
        MODE_SEARCH,
        MODE_EXPLORER} = Constant;


export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = this.getInitState();
        this.failedTimes = 0;
        this.perPage = util.getPerPageItemNumber();
        this.files = [];
    }

    getInitState(){
        const parsed = queryString.parse(location.hash);
        const pageIndex = parseInt(parsed.pageIndex) || 1;
        const isRecursive = !!(parsed.isRecursive === "true");
        const sortOrder = parsed.sortOrder || SORT_BY_DATE;

        return {
            pageIndex,
            isRecursive,
            sortOrder
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

    getHash() {
        return this.props.match.params.tag || 
               this.props.match.params.author ||
               this.props.match.params.search ||
               this.props.match.params.number;
    }

    getMode(){
        if(this.props.match.params.tag){
            return MODE_TAG;
        } else if(this.props.match.params.author) {
            return MODE_AUTHOR;
        } else if(this.props.match.params.number) {
            return MODE_EXPLORER;
        } else if(this.props.match.params.search) {
            return MODE_SEARCH;
        } else {
            return MODE_HOME;
        }
    }

    componentWillReceiveProps(nextProps){
        if(nextProps.filterText){
            this.handlePageChange(1);
        }
    }

    componentDidMount() {
        const hash = this.getHash();
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
    
    componentDidUpdate() {
        this.componentDidMount();
    }

    handleRes(res){
        if (!res.failed) {
            this.loadedHash = this.getHash();
            let {dirs, files, path, tag, author, fileInfos} = res;
            this.loadedHash = this.getHash();
            files = files || [];
            this.videoFiles = files.filter(util.isVideo) || []
            this.files = files.filter(util.isCompress) || [];
            this.dirs = dirs || [];
            this.path = path || "";
            this.tag = tag || "";
            this.author = author || "";
            this.fileInfos = fileInfos || {};
            this.res = res;

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

    requestTextSearch(mode) {
        Sender.post(Constant.SEARCH_API, { text: this.props.match.params.search,  mode: this.getMode()}, res => {
            this.handleRes(res);
        });
    }

    requestSearch(mode) {
        Sender.post(Constant.SEARCH_API, { hash: this.getHash(), 
                                    text: window.localStorage && window.localStorage.getItem(this.getHash()),
                                    mode: this.getMode()}, res => {
            this.handleRes(res);
        });
    }
    
    requestLsDir() {
        Sender.lsDir({ hash: this.getHash(), dir: this.getPathFromLocalStorage(), isRecursive: this.state.isRecursive }, res => {
            this.handleRes(res);
        });
    }
    
    getFilteredFiles(){
        var filterText = this.props.filterText && this.props.filterText.toLowerCase();
        if(filterText){
            return this.files.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }else{
            return this.files;
        }
    }

    getFileInPage(files){
        return files.slice((this.state.pageIndex-1) * this.perPage, (this.state.pageIndex) * this.perPage);
    }

    getPathFromLocalStorage(){
        const hash = this.getHash();
        return window.localStorage && window.localStorage.getItem(hash);
    }

    sortFiles(files, sortOrder){
        //-------sort algo
        const byFn = (a, b) => {
            const ap = util.getFn(a);
            const bp = util.getFn(b);
            return ap.localeCompare(bp);
        }

        if(sortOrder  === SORT_BY_FILENAME){
            files.sort((a, b) => {
                return byFn(a, b);
            });
        }else if(sortOrder === SORT_BY_FOLDER){
            files.sort((a, b) => {
                const ad = util.getDir(a);
                const bd = util.getDir(b);
                if(ad !== bd){
                    return ad.localeCompare(bd);
                } else {
                    return byFn(a, b)
                }
            });
        }else if (sortOrder === SORT_BY_DATE ||  sortOrder === SORT_BY_DATE_REVERSE){
            files.sort((a, b) => {
                const as = this.fileInfos[a];
                const bs = this.fileInfos[b];
                if(as.mtime !== bs.mtime){
                    if(sortOrder === SORT_BY_DATE_REVERSE){
                        return as.mtimeMs - bs.mtimeMs;
                    }else{
                        return bs.mtimeMs - as.mtimeMs;
                    }
                }else{
                    return byFn(a, b);
                }
            });
        }else if (sortOrder === SORT_RANDOMLY){
            files.sort((a, b) => {
                return Math.random() - 0.5;
            });
        }else if (sortOrder === SORT_FROM_BIG || sortOrder === SORT_FROM_SMALL){
            files.sort((a, b) => {
                const as = this.fileInfos[a];
                const bs = this.fileInfos[b];
                if(as.size !== bs.size){
                    if(sortOrder === SORT_FROM_SMALL){
                        return as.size - bs.size;
                    }else{
                        return bs.size - as.size;
                    }
                }else{
                    return byFn(a, b);
                }
            });
        }
    }

    renderFileList() {
        const { sortOrder } = this.state;
        let dirs, files, videos;
        if(!this.getHash()) {
            dirs = userConfig.home_pathes;
            files = [];
            videos = [];
        } else {
            dirs = this.dirs;
            videos = this.videoFiles;
            files = this.getFilteredFiles();
        }

        this.sortFiles(files, sortOrder);
        
        if (_.isEmpty(dirs) && _.isEmpty(files) && _.isEmpty(videos)) {
            if(!this.res){
                return (<CenterSpinner text={this.getPathFromLocalStorage()}/>);
            }else{
                return <center className="one-book-nothing-available">Nothing Available</center>;
            }
        } 
        
        const dirItems = dirs.map((item) =>  {
            const pathHash = stringHash(item);
            const toUrl =('/explorer/'+ pathHash);
            const result =  (
                <li className="explorer-dir-list-item" key={item}>
                <i className="far fa-folder"></i>
                <span className="explorer-dir-list-item">{item}</span>
                </li>
            );
            return  <Link to={toUrl}  key={item}>{result}</Link>;
        });

        const videoItems = videos.map((item) =>  {
            const pathHash = stringHash(item);
            const toUrl =('/videoPlayer/'+ pathHash);
            const result =  (
                <li className="explorer-dir-list-item" key={item}>
                <i className="far fa-file-video"></i>
                <span className="explorer-dir-list-item">{item}</span>
                </li>
            );
            return  <Link to={toUrl}  key={item}>{result}</Link>;
        });

        //! !todo if the file is already an image file
        files = this.getFileInPage(files);

        //better tooltip to show file size 
        //and tag
        const zipfileItems = files.map((item, index) => {
            const text = _.getFn(item);
            const pathHash = stringHash(item);
            const toUrl =  '/onebook/' + pathHash;

            //todo
            const stats = this.fileInfos[item];
            const fileSize = stats && filesizeUitl(stats.size, {base: 2});

            let seperator;

            if(sortOrder === SORT_BY_FOLDER && 
                (this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH )){
                const prev = files[index - 1];
                if(!prev || util.getDir(prev) !== util.getDir(item)){
                    seperator = (<div className="col-12"  key={item+"---seperator"}> 
                                 <Breadcrumb path={util.getDir(item)}/>
                                 </div>);
                }
            }
            
            return (<React.Fragment  key={item}>
                    {seperator}
                    <div key={item} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
                        <div className="file-cell">
                            <Link  target="_blank" to={toUrl}  key={item} className={"file-cell-inner"}>
                                <center className={"file-cell-title"} title={text}>{text}</center>
                                <LoadingImage className={"file-cell-thumbnail"} title={item} fileName={item} />
                            </Link>
                            <FileChangeToolbar header={fileSize} file={item} />
                        </div>
                    </div>
                    </React.Fragment>);
        });

        return (
            <div className={"explorer-container"}>
                <ul className={"dir-list container"}>
                    {dirItems}
                </ul>

                <ul className={"dir-list container"}>
                    {videoItems}
                </ul>

                <div className={"file-grid container"}>
                    <div className={"row"}>
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
        this.setStateAndSetHash({
            pageIndex: 1,
            isRecursive: !this.state.isRecursive
        }, ()=>{
            this.failedTimes = 0;
            this.requestLsDir();
        })
    }

    getExplorerToolbar(){
        const mode = this.getMode();
        if(mode === MODE_EXPLORER && this.path){
            const text = this.state.isRecursive? "Show only one level" : "Show Recursively";
            const right = (
            <div className="float-right">
                <span key="recursive-button" className="recursive-button fas fa-glasses" onClick={this.toggleRecursively.bind(this)}> {text} </span>
                <span key="file-count" className="file-count">{this.getFilteredFiles().length + " files"} </span>
            </div>);

            return <div className="container"><Breadcrumb path={this.path} right={right}/></div>
        }
    }

    getTitle(){
        const mode = this.getMode();
        const fn = " (" + (this.files||[]).length + ")";

        if(mode === MODE_HOME){
            return "";
        }else if(this.tag && mode === "tag") {
            return "Tag: " + this.tag + fn;
        } else if(this.author && mode === MODE_AUTHOR) {
            return "Author: " + this.author + fn;
        } else if(mode === MODE_SEARCH){
            return "Search Result: " + this.getHash() + fn;
        }
    }

    getLinkToEhentai(){
        let searchable = this.tag || this.author;
        if(this.getMode() === MODE_SEARCH){
            searchable = this.getHash();
        }

        if(searchable){
            const link = "https://exhentai.org/?f_search=" + searchable;
            const title = "Search '"  + searchable +  "' in Exhentai";
            return (<center className={"location-title"}>
                        <a className="explorer-external-link" target="_blank" href={link} title={title}>{this.getTitle()} </a>
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
        return (<Pagination current={this.state.pageIndex}  
                            pageSize={this.perPage}
                            total={fileLength} 
                            itemRender={(item, type) =>{
                                if(type === "page"){
                                    let hash =  that.getHash();
                                    const obj = Object.assign({}, this.state);
                                    obj.pageIndex = item;
                                    hash += "#" + queryString.stringify(obj);
                                    return  <Link to={hash}  >{item}</Link>;
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
            document.title = this.tag||this.author||this.path||this.props.match.params.search|| "ShiguReader";
        }
    }

    onSortChange(e){
        this.setStateAndSetHash({sortOrder: e.target.value})
    }

    renderSideMenu(){
        const SORT_OPTIONS = [
            SORT_BY_DATE,
            SORT_BY_DATE_REVERSE,
            SORT_FROM_BIG,
            SORT_FROM_SMALL,
            SORT_BY_FILENAME
        ];

        if(this.getMode() !== MODE_EXPLORER){
            SORT_OPTIONS.push(SORT_BY_FOLDER);
        }

        SORT_OPTIONS.push(SORT_RANDOMLY);

        if(this.getMode() !== MODE_HOME){
            return (<div className="side-menu">
                    <div className="side-menu-radio-title"> File Order </div>
                    <RadioButtonGroup defaultChecked={SORT_OPTIONS.indexOf(this.state.sortOrder)} options={SORT_OPTIONS} name="explorer-sort-order" onChange={this.onSortChange.bind(this)}/>
                </div>)
        }
    }
    
    render() {
        this.setWebTitle();

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        }

        return (<div className={"explorer-container-out " + this.getMode()} >
            {this.renderSideMenu()}
            {this.getLinkToEhentai()}
            {this.getExplorerToolbar()}
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
    cookies: PropTypes.any,
    filterText: PropTypes.string
};
