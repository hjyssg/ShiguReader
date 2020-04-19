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
const isPad = util.isPad;
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
import Breadcrumb from './subcomponent/Breadcrumb';
import Checkbox from './subcomponent/Checkbox';
const nameParser = require('../name-parser');
const classNames = require('classnames');

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

const GOOD_STANDARD = 2;

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = this.getInitState();
        this.failedTimes = 0;
        this.files = [];
    }

    getNumPerPage(){
        return this.state.noThumbnail? 40 :  util.getPerPageItemNumber();
    }

    getInitState(){
        const parsed = queryString.parse(location.hash);
        const pageIndex = parseInt(parsed.pageIndex) || 1;
        const isRecursive = !!(parsed.isRecursive === "true");
        const sortOrder = parsed.sortOrder || SORT_BY_DATE;
        const showVideo = !!(parsed.showVideo === "true");
    
        return {
            anchorSideMenu: false,
            pageIndex,
            isRecursive,
            sortOrder,
            showVideo,
            filterByGoodAuthorName: parsed.filterByGoodAuthorName === "true",
            filterByFirstTime: parsed.filterByFirstTime === "true",
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

            this.setState({
                filterText: nextProps.filterText
            })
        }
    }

    askServer(){
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

    componentDidMount() {
        this.askServer();

        Sender.get('/api/getGoodAuthorNames', res =>{
            this.setState({
                goodAuthors: res.goodAuthors,
                otherAuthors: res.otherAuthors
            })
        });
    }
    
    componentDidUpdate() {
        this.askServer();
    }

    handleRes(res){
        if (!res.failed) {
            this.loadedHash = this.getHash();
            let {dirs, files, path, tag, author, fileInfos, thumbnails} = res;
            this.loadedHash = this.getHash();
            files = files || [];
            this.videoFiles = files.filter(util.isVideo) || []
            this.files = files.filter(util.isCompress) || [];
            this.dirs = dirs || [];
            this.path = path || "";
            this.tag = tag || "";
            this.author = author || "";
            this.fileInfos = fileInfos || {};
            this.thumbnails = thumbnails || {};
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
        let files = this.files;
        const goodSet = this.state.goodAuthors;
        const otherSet = this.state.otherAuthors;
        if(this.state.filterByGoodAuthorName && goodSet && otherSet){
             files = files.filter(e => {
                 const temp = nameParser.parse(e);
                 if(temp && temp.author && goodSet[temp.author] && goodSet[temp.author] > GOOD_STANDARD){
                     return e;
                 }
             })
         }

         if(this.state.filterByFirstTime && goodSet && otherSet){
            files = files.filter(e => {
                const temp = nameParser.parse(e);
                if(temp && temp.author && ((goodSet[temp.author]||0) + (otherSet[temp.author]||0)) <= 1){
                    
                    return e;
                }
            })
         }

        var filterText = this.state.filterText && this.state.filterText.toLowerCase();
        if(filterText){
            return files.filter(e => {
                return e.toLowerCase().indexOf(filterText) > -1;
            });
        }else{
            return files;
        }
    }

    getFileInPage(files){
        return files.slice((this.state.pageIndex-1) * this.getNumPerPage(), (this.state.pageIndex) * this.getNumPerPage());
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

        let inRandom = false;

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
               

                const fileTimeA = (this.fileInfos[a] && this.fileInfos[a].mtimeMs) || Infinity;
                const fileTimeB = (this.fileInfos[b] && this.fileInfos[b].mtimeMs) || Infinity;

                function comprTime(at, bt){
                    let result;
                    if(sortOrder === SORT_BY_DATE_REVERSE){
                        result = at - bt;
                    }else{
                        result = bt - at;
                    }

                    if(result === 0){
                        result = byFn(a, b);
                    }
                    return result;
                }

                if(this.getMode() === MODE_EXPLORER){
                    return comprTime(fileTimeA, fileTimeB);
                }else{

                    const pA = nameParser.parse(util.getFn(a));
                    const pB = nameParser.parse(util.getFn(b));
    
                    let aboutTimeA = pA && nameParser.getDateFromTags(pA.tags);
                    let aboutTimeB = pB && nameParser.getDateFromTags(pB.tags);
    
                    aboutTimeA = aboutTimeA && aboutTimeA.getTime();
                    aboutTimeB = aboutTimeB && aboutTimeB.getTime();

                    return comprTime(aboutTimeA || fileTimeA, aboutTimeB || fileTimeB);
                }
            });
        } else if (sortOrder === SORT_FROM_BIG || sortOrder === SORT_FROM_SMALL){
            files.sort((a, b) => {
                const ass = (this.fileInfos[a] && this.fileInfos[a].size) || 0;
                const bs =  (this.fileInfos[b] && this.fileInfos[b].size) || 0;
                if(ass !== bs){
                    if(sortOrder === SORT_FROM_SMALL){
                        return ass - bs;
                    }else{
                        return bs - ass;
                    }
                }else{
                    return byFn(a, b);
                }
            });
        } else if (sortOrder === SORT_RANDOMLY){
            if(!this.isAlreadyRandom){
                files.sort((a, b) => {
                    return Math.random() - 0.5;
                });
            }
            inRandom = true;
        }

        this.isAlreadyRandom = inRandom;
    }

    getOneLineListItem(icon, item){
        return (<li className="explorer-one-line-list-item" key={item}>
        {icon}
        <span className="explorer-one-line-list-item-text">{item}</span>
        </li>);
    }

    renderFileList() {
        const { sortOrder } = this.state;
        let dirs, files, videos;
        if(!this.getHash()) {
            dirs = userConfig.home_pathes.concat(userConfig.good_folder);
            files = [];
            videos = [];
        } else {
            dirs = this.dirs;
            videos = this.videoFiles;
            files = this.getFilteredFiles();
        }

        try {
            this.sortFiles(files, sortOrder);
        }catch(e){
            console.error(e);
        }
        
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
            const result =  this.getOneLineListItem(<i className="far fa-folder"></i>, item);
            return  <Link to={toUrl}  key={item}>{result}</Link>;
        });

        let videoItems;

        if(this.state.showVideo){
                videoItems = videos.map((item) =>  {
                   const pathHash = stringHash(item);
                   const toUrl =('/videoPlayer/'+ pathHash);
                   const result =  (
                       <li className="explorer-one-line-list-item" key={item}>
                       <i className="far fa-file-video"></i>
                       <span className="explorer-one-line-list-item">{item}</span>
                       </li>
                   );
                   return  <Link to={toUrl}  key={item}>{result}</Link>;
               });
        }

        //! !todo if the file is already an image file
        files = this.getFileInPage(files);

        //better tooltip to show file size 
        //and tag
        let breadcrumbCount = 0;
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
                                 <Breadcrumb path={util.getDir(item)} className={breadcrumbCount > 0? "not-first-breadcrumb": "" }/>
                                 </div>);
                    breadcrumbCount++;
                }
            }

            let zipItem;

            if(this.state.noThumbnail){
                zipItem = (<Link to={toUrl}  key={item} className={""}>
                        {this.getOneLineListItem(<i className="fas fa-book"></i>, text)}
                        </Link>)
            }else{
                zipItem = (
                <div key={item} className={"col-sm-6 col-md-4 col-lg-3 file-out-cell"}>
                    <div className="file-cell">
                        <Link  target="_blank" to={toUrl}  key={item} className={"file-cell-inner"}>
                            <center className={"file-cell-title"} title={text}>{text}</center>
                            <LoadingImage 
                                    isThumbnail 
                                    className={"file-cell-thumbnail"} 
                                    title={item} fileName={item}   
                                    url={this.thumbnails[item]}
                                    onReceiveUrl={url => {this.thumbnails[item] = url;}} 
                                    />
                        </Link>
                        <FileChangeToolbar header={fileSize} file={item} />
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

                {
                    this.state.showVideo &&  
                    (<ul className={"dir-list container"}>
                        {videoItems}
                    </ul>)
                }

                {this.renderPagination()}
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
           <span className="thumbnail-button exp-top-button" onClick={this.toggleThumbNail.bind(this)}>
                <span className="fas fa-book" /> <span>{text2} </span> 
            </span>
        );
    }

    getExplorerToolbar(){
        const mode = this.getMode();
        if(mode === MODE_EXPLORER && this.path){
            const text = this.state.isRecursive? "Show only one level" : "Show subfolder's files";
            const text2 = this.state.showVideo? "hide video" : "show video";
            const right = (
            <div className="top-button-gropus">
                {this.renderToggleThumbNailButton()}
                <span className="recursive-button exp-top-button" onClick={this.toggleRecursively.bind(this)}> 
                    <span className="fas fa-glasses" />
                    <span> {text} </span>
                </span>

                <span className="show-video-button exp-top-button" onClick={this.toggleShowVideo.bind(this)}> 
                    <span className="fas fa-video" />
                    <span> {text2} </span>
                </span>

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
        }else if(this.tag && mode === MODE_TAG) {
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

            let btn;
            if(this.getMode() === MODE_AUTHOR || this.getMode() === MODE_TAG || this.getMode() === MODE_SEARCH){
                btn = this.renderToggleThumbNailButton();
            }


            return (<center className={"location-title"}>
                        <a className="explorer-external-link" target="_blank" href={link} title={title}>{this.getTitle()} </a>
                        {btn}
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
                            pageSize={this.getNumPerPage()}
                            showQuickJumper={{goButton: true}}
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
        this.setStateAndSetHash({sortOrder: e})
    }

    toggleSideMenu(event){
        if(event.target.className.includes( "side-menu-click-layer")){
            this.setState({anchorSideMenu: !this.state.anchorSideMenu})
        }
    }

    setFilterText(text){
        this.setStateAndSetHash({filterText: text, pageIndex: 1});
    }

    toggleGoodAuthor(){
        this.setStateAndSetHash({
            filterByGoodAuthorName: !this.state.filterByGoodAuthorName
        });
    };

    // toggleOversizeImage(){
    //     this.setStateAndSetHash({
    //         filterByOversizeImage: !this.state.filterByOversizeImage
    //     });
    // };

    toggleFirstTime(){
        this.setStateAndSetHash({
            filterByFirstTime: !this.state.filterByFirstTime
        });
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

        let info;
        const files = this.getFilteredFiles() || [];
        let totalSize = 0;
        files.forEach(e => {
            if(this.fileInfos[e]){
                totalSize += this.fileInfos[e].size;
            }
        });
        info = <div className="side-menu-folder-small-info">{filesizeUitl(totalSize, {base: 2})} </div>

        const tag2Freq = {};

        files.forEach(e => {
            const result = nameParser.parse(_.getFn(e));
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
            return (<div className="side-menu-single-tag" onClick={() => this.setFilterText(t)} key={t}>
                        {t}<span>({tag2Freq[t]})</span> 
                    </div>);
        });


        const showAll = (
        <div className="side-menu-single-tag" onClick={() => this.setFilterText("")} key={"----null------"}>
            All
        </div>);

        tagInfos.unshift(showAll);

        //no one pay me, I am not going to improve the ui
        let checkbox;
        if(this.state.goodAuthors){
            checkbox = (<Checkbox  onChange={this.toggleGoodAuthor.bind(this)} checked={this.state.filterByGoodAuthorName}>
                            title={`need to found more than ${GOOD_STANDARD} times in good folder`}
                             By good_folder_root 
                        </Checkbox> );       
        }   

        // const st2 = `image size bigger than ${userConfig.oversized_image_size} MB` ;

        // let checkbox2 = (<Checkbox  onChange={this.toggleOversizeImage.bind(this)} checked={this.state.filterByOversizeImage}>
        //                            {st2}   
        //                     </Checkbox> ); 

        const st3 = `first time` ;

        let checkbox3 = (<Checkbox  onChange={this.toggleFirstTime.bind(this)} checked={this.state.filterByFirstTime}>
                                   {st3}   
                            </Checkbox> ); 

        if(this.getMode() !== MODE_HOME){
            const cn = classNames("side-menu", "side-menu-click-layer", {
                anchorSideMenu: this.state.anchorSideMenu
            });

            return (<div className={cn} onClick={this.toggleSideMenu.bind(this)}>
                    <div className="side-menu-radio-title"> File Order </div>
                    <RadioButtonGroup 
                            checked={SORT_OPTIONS.indexOf(this.state.sortOrder)} 
                            options={SORT_OPTIONS} name="explorer-sort-order" 
                            onChange={this.onSortChange.bind(this)}/>
                    <div className="side-menu-radio-title"> Special Filter </div>
                    {checkbox}
                    {checkbox3}
                    {info}
                    {tagInfos}
                </div>)
        }
    }

    render() {
        this.setWebTitle();

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        }

        const cn = classNames("explorer-container-out", this.getMode().replace(" ", "_"));

        return (<div className={cn} >
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
