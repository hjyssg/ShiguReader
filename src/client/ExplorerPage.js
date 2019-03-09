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
const stringHash = util.stringHash;;

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

        return {
            pageIndex,
            isRecursive
        }
    }

    setStateAndSetHash(state, callback){
        const obj = Object.assign({}, this.state, state);
        //merge
        location.hash = queryString.stringify(obj);
        this.setState(state, callback);
    }

    handlePageChange(index){
        this.setStateAndSetHash({ pageIndex: index});
        // location.hash = queryString.stringify({pageIndex: index});
    }

    getHash() {
        return this.props.match.params.tag || 
               this.props.match.params.author ||
               this.props.match.params.search ||
               this.props.match.params.number;
    }

    getMode(){
        if(this.props.match.params.tag){
            return "tag"
        } else if(this.props.match.params.author) {
            return "author"
        } else if(this.props.match.params.number) {
            return "explorer";
        } else if(this.props.match.params.search) {
            return "search";
        } else {
            return "home"
        }
    }

    componentDidMount() {
        const hash = this.getHash();
        if (hash && this.loadedHash !== hash && this.failedTimes < 3) {
            if(this.getMode() === "tag"){
                this.requestSearch();
            } else if(this.getMode() === "author"){
                this.requestSearch();
            } else if (this.getMode() === "search"){
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
            files = files.filter(util.isCompress)
            this.files = files || [];
            this.dirs = dirs || [];
            this.path = path || "";
            this.tag = tag || "";
            this.author = author || "";
            this.fileInfos = fileInfos || {};
            this.res = res;

            //check pageindex
            const fileNum = this.getFilteredFiles().length;
            if(this.state.pageIndex * this.perPage > fileNum){
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
        Sender.post("/api/search", { text: this.props.match.params.search,  mode: this.getMode()}, res => {
            this.handleRes(res);
        });
    }

    requestSearch(mode) {
        Sender.post("/api/search", { hash: this.getHash(),  mode: this.getMode()}, res => {
            this.handleRes(res);
        });
    }
    
    requestLsDir() {
        Sender.lsDir({ hash: this.getHash(), isRecursive: this.state.isRecursive }, res => {
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

    renderFileList() {
        let dirs, files;
        if(!this.getHash()) {
            dirs = userConfig.home_pathes;
            files = [];
        } else {
            dirs = this.dirs;
            files = this.getFilteredFiles();
        }

        if(this.getMode() === "tag" || this.getMode() === "author" || this.getMode() === "search"){
            files.sort((a, b) => {
                const ap = util.getFn(a);
                const bp = util.getFn(b);
                return ap.localeCompare(bp);
            });
        }
        
        if (_.isEmpty(dirs) && _.isEmpty(files)) {
            if(!this.res){
                const hash = this.getHash();
                const text = window.localStorage && window.localStorage.getItem(hash);
                return (<CenterSpinner text={text}/>);
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
        //! !todo if the file is already an image file
        files = files.slice((this.state.pageIndex-1) * this.perPage, (this.state.pageIndex) * this.perPage);

        //better tooltip to show file size 
        //and tag
        const zipfileItems = files.map((item) => {
            const text = _.getFn(item);
            const pathHash = stringHash(item);
            const toUrl =  '/onebook/' + pathHash;

            //todo
            const stats = this.fileInfos[item];
            const fileSize = stats && filesizeUitl(stats.size, {base: 2});
            
            return (<div key={item} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
                        <div className="file-cell">
                            <Link  target="_blank" to={toUrl}  key={item} className={"file-cell-inner"}>
                                <center className={"file-cell-title"} title={text}>{text}</center>
                                <LoadingImage className={"file-cell-thumbnail"} title={item} fileName={item} />
                            </Link>
                            <FileChangeToolbar header={fileSize} file={item} />
                        </div>
                    </div>);
        });

        return (
            <div className={"explorer-container"}>
                <ul className={"dir-list container"}>
                    {dirItems}
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
        if(mode === "explorer" && this.path){
            // return "At " + this.path;
            const pathes = this.path.split("\\");
            const pathList = [];
            //https://www.w3schools.com/howto/howto_css_breadcrumbs.asp
            for(let ii =0; ii < pathes.length; ii++){
                let item = pathes.slice(0, ii+1).join("\\");
                if(ii === pathes.length -1){
                    //last one not link
                    pathList.push(<div key={item} className={"breadcrumb-item current"}>{pathes[ii]} </div>);
                }else{
                    const pathHash = stringHash(item);
                    const toUrl =('/explorer/'+ pathHash);
                    pathList.push(<Link to={toUrl}  key={item} className={"breadcrumb-item"}>{pathes[ii]}</Link>);
                }
            }

            const text = this.state.isRecursive? "Show only one level" : "Show Recursively";
            const right = (
                <div className="float-right">
                    <span key="recursive-button" className="recursive-button fas fa-glasses" onClick={this.toggleRecursively.bind(this)}> {text} </span>
                    <span key="file-count" className="file-count">{`${this.getFilteredFiles().length} files`} </span>
                </div>);


            return   (<div className="container"><ul className="explorer-breadcrumb">{pathList}{right}</ul></div>);
        }
    }

    getTitle(){
        const mode = this.getMode();
        const fn = " (" + (this.files||[]).length + ")";

        if(mode === "home"){
            return "";
        }else if(this.tag && mode === "tag") {
            return "Tag: " + this.tag + fn;
        } else if(this.author && mode === "author") {
            return "Author: " + this.author + fn;
        } else if(mode === "search"){
            return "Search Result: " + this.getHash() + fn;
        }
    }

    getLinkToEhentai(){
        let searchable = this.tag || this.author;
        if(this.getMode() === "search"){
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
        if(this.getMode() === "home"){
            return;
        }
        const fileLength = this.getFilteredFiles().length;
        if(fileLength === 0){
          return;
        }
    
        return (<Pagination current={this.state.pageIndex}  
                            pageSize={this.perPage}
                            total={fileLength} 
                            onChange={this.handlePageChange.bind(this)} />);
    }

    setWebTitle(){
        const mode = this.getMode();
        if(mode === "home"){
            document.title = "ShiguReader";
        }else{
            document.title = this.tag||this.author||this.path||this.props.match.params.search|| "ShiguReader";
        }
    }
    
    render() {
        this.setWebTitle();

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        }

        return (<div className={"explorer-container-out " + this.getMode()} >
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
