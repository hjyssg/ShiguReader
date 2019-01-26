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
const PER_PAGE = 6 * 20;

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = { pageIndex: 0 };
    }

    getHash() {
        return this.props.match.params.tag || 
               this.props.match.params.author||
               this.props.match.params.search||
               this.props.match.params.number;
    }

    getMode(){
        if(this.props.match.params.tag){
            return "tag"
        }if(this.props.match.params.author){
            return "author"
        }else if(this.props.match.params.number){
            return "explorer";
        }else if(this.props.match.params.search){
            return "search";
        }else{
            return "home"
        }
    }

    componentDidMount() {
        const hash = this.getHash();
        if (hash && this.loadedHash !== hash) {
            if(this.getMode() === "tag"){
                this.requestSearch();
            }else if(this.getMode() === "author"){
                this.requestSearch();
            }else if(this.getMode() === "search"){
                this.requestTextSearch();
            }  else {
                this.requestLsDir();
            }
        }
    }
    
    componentDidUpdate() {
        this.componentDidMount();
    }

    requestTextSearch(mode) {
        Sender.post("/api/search", { text: this.props.match.params.search,  mode: this.getMode()}, res => {
            if (!res.failed) {
                this.loadedHash = this.getHash();
                this.files = res.files|| [];
                this.dirs = [];
                this.tag = res.tag;
                this.author = res.author;
            }
            this.forceUpdate();
            this.res = res;
        });
    }

    requestSearch(mode) {
        Sender.post("/api/search", { hash: this.getHash(),  mode: this.getMode()}, res => {
            if (!res.failed) {
                this.loadedHash = this.getHash();
                this.files = res.files|| [];
                this.dirs = [];
                this.tag = res.tag;
                this.author = res.author;
              }
              this.forceUpdate();
              this.res = res;
        });
    }
    
    requestLsDir() {
        Sender.lsDir({ hash: this.getHash() }, res => {
            if (!res.failed) {
                const {dirs, files, path} = res;
                this.files = files|| [];
                this.dirs = dirs||[];
                this.path = path;
                this.loadedHash = this.getHash();
                this.forceUpdate();
            } else {
                this.res = res;
                this.forceUpdate();
            }
        });
    }
    
    renderFileList() {
        let dirs, files;
        if(!this.getHash()) {
            dirs = userConfig.home_pathes;
            files = [];
        } else {
            dirs = this.dirs;
            files = this.files;
        }
        
        if (_.isEmpty(dirs) && _.isEmpty(files)) {
            if(this.res){
                return (<div className="explorer-page-loading">
                {<Spinner />}
                { "Loading..."}
              </div>);
            }else{
                return <center className="">Empty Folder</center>;
            }
        } 
        
        //! todo when there is >6000 files, does not need to render all  list
        const dirItems = dirs.map((item) =>  {
            const text =  _.getFn(item);
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

        files = files.filter(_.isCompress);
        files = files.slice(this.state.pageIndex * PER_PAGE, (this.state.pageIndex+1) * PER_PAGE);

        const zipfileItems = files.map((item) => {
            const text = _.getFn(item);
            const pathHash = stringHash(item);
            const toUrl =  '/onebook/' + pathHash;
            return (<div key={item} className="col-sm-6 col-md-4 col-lg-3 file-out-cell">
                        <div className="file-cell">
                            <Link to={toUrl}  key={item} className="file-cell-inner">
                                <center className="file-cell-title">{text}</center>
                                <LoadingImage className="file-cell-thumbnail" fileName={item} />
                            </Link>
                            <FileChangeToolbar file={item} />
                        </div>
                    </div>);
        });

        return (
            <div className="explorer-container">
                <ul className="dir-list container">
                    {dirItems}
                </ul>
                <div className="file-grid container">
                    <div className="row">
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

        if(this.tag && mode === "tag") {
            return "Tag: " + this.tag + fn;
        } else if(this.author && mode === "author") {
            return "Author: " + this.author + fn;
        } else if(this.path){
            return "At " + this.path;
        } else if(mode === "search"){
            return "Search Result: " + this.getHash() + fn;
        }
    }

    handlePageChange(index){
        this.setState({ pageIndex: index+1});
      }
    
    renderPagination(){
        const fileLength = (this.files||[]).length;
        if(fileLength === 0){
          return;
        }
    
        return (<Pagination current={this.state.pageIndex+1}  
                            pageSize={PER_PAGE}
                            total={fileLength} 
                            onChange={this.handlePageChange.bind(this)} />);
      }
    
    render() {
        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        }

        document.title = this.tag||this.author||this.path||this.props.match.params.search||"ShiguReader";
        return (<div className={"explorer-container-out " + this.getMode()} >
            <center className="location-title">{this.getTitle()}</center>
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
    cookies: PropTypes.any
};
