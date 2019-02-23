// @flow
import React, { Component } from 'react';
import _ from "underscore";
import './style/Explorer.scss';
import PropTypes from 'prop-types';
import LoadingImage from './LoadingImage';
import Sender from './Sender';
import { Link } from 'react-router-dom';
import stringHash from "string-hash";
const userConfig = require('../user-config');
import ErrorPage from './ErrorPage';
import Pagination from 'rc-pagination';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import CenterSpinner from './subcomponent/CenterSpinner';
const util = require("../util");
const queryString = require('query-string');

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = { pageIndex: this.getInitPageIndex()};
        this.failedTimes = 0;
        this.perPage = util.getPerPageItemNumber();
    }

    getInitPageIndex(){
        const parsed = queryString.parse(location.hash);
        return parseInt(parsed.pageIndex) || 1;
    }

    handlePageChange(index){
        this.setState({ pageIndex: index});
        location.hash = queryString.stringify({pageIndex: index});
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
            let {dirs, files, path, tag, author} = res;
            this.loadedHash = this.getHash();
            files = files.filter(_.isCompress)
            this.files = files || [];
            this.dirs = dirs || [];
            this.path = path || "";
            this.tag = tag || "";
            this.author = author || "";
        }else{
            this.failedTimes++;
        }
        this.res = res;
        this.forceUpdate();
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
        Sender.lsDir({ hash: this.getHash() }, res => {
            this.handleRes(res);
        });
    }
    
    getFilteredFiles(){
        var filterText = this.props.filterText && this.props.filterText.toLowerCase();
        if(filterText){
            return (this.files||[]).filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }else{
            return (this.files||[]);
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
                return (<CenterSpinner />);
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

      
        const zipfileItems = files.map((item) => {
            const text = _.getFn(item);
            const pathHash = stringHash(item);
            const toUrl =  '/onebook/' + pathHash;
            return (<div key={item} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
                        <div className="file-cell">
                            <Link to={toUrl}  key={item} className={"file-cell-inner"}>
                                <center className={"file-cell-title"} title={text}>{text}</center>
                                <LoadingImage className={"file-cell-thumbnail"} title={text} fileName={item} />
                            </Link>
                            <FileChangeToolbar file={item} />
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

    getTitle(){
        const mode = this.getMode();
        const fn = " (" + (this.files||[]).length + ")";

        if(mode === "home"){
            return "";
        }else if(this.tag && mode === "tag") {
            return "Tag: " + this.tag + fn;
        } else if(this.author && mode === "author") {
            return "Author: " + this.author + fn;
        } else if(mode === "explorer" && this.path){
            return "At " + this.path;
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
            return <a className="explorer-external-link" href={link} title={title}>{this.getTitle()} </a>;
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
            <center className={"location-title"}>{this.getLinkToEhentai()}</center>
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
