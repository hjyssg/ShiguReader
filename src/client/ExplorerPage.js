// @flow
import React, { Component } from 'react';
import _ from "underscore";
import './style/explorer.css';
import PropTypes from 'prop-types';
import LoadingImage from './LoadingImage';
import folderIcon from './images/folder.png';
import Sender from './Sender';
import { Link } from 'react-router-dom';
const userConfig = require('../user-config');
import stringHash from "string-hash";

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
    }
    
    getHash() {
        return this.props.match.params.tag || this.props.match.params.number;
    }

    getMode(){
        if(this.props.match.params.tag){
            return "tag"
        }else{
            return "explorer";
        }
    }

    componentDidMount() {
        const hash = this.getHash();
        if (hash && this.loadedHash !== hash) {
            if(this.getMode() === "tag"){
                this.requestTagSearch();
            }else{
                this.requestLsDir();
            }
        }
    }
    
    componentDidUpdate() {
        this.componentDidMount();
    }

    requestTagSearch(tag) {
        Sender.post("/api/tagSearch", { hash: this.getHash() }, res => {
            if (!res.failed) {
                this.loadedHash = this.getHash();
                this.files = res.tagFiles|| [];
                this.dirs = [];
                this.tag = res.tag;
                this.forceUpdate();
              }else{
                this.res = res;
                this.forceUpdate();
              }
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
    
    RenderRow(item, isFolder) {
        const imageContent = isFolder? <img className="row-thumbnail-image" src={folderIcon} alt="folder-thumbnail"/>:
                            <LoadingImage className="row-thumbnail-image row-thumbnail-file-image" fileName={item} />;
        const text = isFolder? item: _.getFn(item);
        const pathHash = stringHash(item);
        const toUrl = isFolder? ('/explorer/'+ pathHash) : ('/onebook/' + pathHash);
        const result =  (
            <li className="list-group-item home-row" key={item}>
            {imageContent}
            <span className="row-file-name">{text}</span>
            </li>
        );

        return  <Link to={toUrl}  key={item}>{result}</Link>;
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
            return (
                <div className="alert alert-info" role="alert">Loading...</div>
            );
        }
        
        //! todo when there is >6000 files, does not need to render all  list
        const dirItems = dirs.map((item) => this.RenderRow(item, "isDir"));
        //! !todo if the file is already an image file
        const zipfileItems = files.filter(_.isCompress).map((item) => this.RenderRow(item));
        return (
            <ul className="list-group">
            {dirItems}
            {zipfileItems}
            </ul>
        );
    }
    
    componentDidCatch(error) {
        // Display fallback UI
        console.error(error);
    }
    
    render() {
        if (this.res && this.res.failed) {
            return <h1>{this.res.res.status + " " + this.res.res.statusText}</h1>;
        }
        return (
            <div className="home-container">
            {this.renderFileList()}
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
