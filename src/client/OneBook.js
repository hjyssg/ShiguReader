import React, { Component, useState, useEffect } from 'react';
import _ from 'underscore';
const classNames = require('classnames');
import ReactDOM from 'react-dom';

import { Link } from 'react-router-dom';
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import Spinner from './subcomponent/Spinner';
import CenterSpinner from './subcomponent/CenterSpinner';
import FileNameDiv from './subcomponent/FileNameDiv';
import BookImage from './subcomponent/BookImage';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import HistorySection from './subcomponent/HistorySection';
import MusicPlayer from './MusicPlayer';
import $ from 'jquery'
import "./style/BigColumnButton.scss";

const util = require("@common/util");
const queryString = require('query-string');
import screenfull from 'screenfull';

const MIN_HEIGHT = 400;
const MIN_WIDTH = 400;
const userConfig = require('@config/user-config');
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, isMobile, getFileUrl, sortFileNames, filesizeUitl } = clientUtil;
import { GlobalContext } from './globalContext'

const NO_TWO_PAGE = "no_clip";
const TWO_PAGE_LEFT = "left";
const TWO_PAGE_RIGHT = "right";


export default class OneBook extends Component {
  constructor(props) {
    super(props);

    this.zoom_scale = null;

    this.state = {
      imageFiles: [],
      musicFiles: [],
      index: this.getInitIndex(),
      twoPageMode: NO_TWO_PAGE
    };
  }

  getInitIndex() {
    const parsed = queryString.parse(location.hash);
    return parseInt(parsed.index) || 0;
  }

  setIndex(index) {
    clientUtil.replaceUrlHash(queryString.stringify({ index }));
  }

  getTextFromQuery(props) {
    const _props = props || this.props;
    return queryString.parse(_props.location.search)["p"] || "";
  }

  askRerender(){
    this.setState({
        rerenderTick: !this.state.rerenderTick
    })
  }

  componentDidMount() {
    this.sendRequest();

    if (!isMobile()) {
      screenfull.onchange(() => {
        this.askRerender();
      });
    }

    this._adjustImageSize = this.adjustImageSize.bind(this);
    window.addEventListener("resize", this._adjustImageSize);
  }

  updateScrollPos(e) {
    // $('html').css('cursor', 'row-resize');
    // console.log(this.clickY, e.pageY, this.clickY - e.pageY );
    const ADJUSTER = 1.05;
    let change = $(window).scrollTop() + (this.clickY - e.pageY) * ADJUSTER;
    $(window).scrollTop(change);
    // console.log(change)


    change = $(window).scrollLeft() + (this.clickX - e.pageX) * ADJUSTER;
    $(window).scrollLeft(change);
  }

  getMaxHeight() {
    if (isMobile()) {
      return window.screen.height - 10;
    }

    let maxHeight = 952;
    if (this.hasMusic()) {
      maxHeight = 450;
    } else {
      maxHeight = isNaN(window.innerHeight) ? window.clientHeight : window.innerHeight;
    }
    return maxHeight - 10;
  }

  getMaxWidth() {
    if (isMobile()) {
      return window.screen.width;
    }
    const result = isNaN(window.innerWidth) ? window.clientWidth : window.innerWidth;
    return result - 50;
  }

  adjustImageSize() {
    if (isMobile()) {
      return;
    }

    this.loadedImage = this.state.index;
    const imageDom = ReactDOM.findDOMNode(this.imgRef);
    if (!imageDom) {
      return;
    }
    this.imgDomHeight = imageDom.clientHeight;
    this.imgDomWidth = imageDom.clientWidth;
    this.imgTrueHeight = imageDom.naturalHeight;
    this.imgTrueWidth = imageDom.naturalWidth;

    if (this.zoom_scale && userConfig.keep_zoom_scale) {
      this.applyHWToImage((this.imgTrueHeight * this.zoom_scale), (this.imgTrueWidth * this.zoom_scale));
      return;
    }

    //display img's real px number
    const dimDom = document.getElementsByClassName("dimension-tag")[0];
    if (dimDom) {
      dimDom.textContent = `${imageDom.naturalWidth}×${imageDom.naturalHeight}`;
    }

    this.clicked = false;
    this.clickY = 0;
    this.clickX = 0;

    //set max height
    const maxHeight = this.getMaxHeight();
    const maxWidth = this.getMaxWidth();

    const widthRatio = this.imgDomWidth / maxWidth;
    const heighthRatio = this.imgDomHeight / maxHeight;

    const naturalhwRatio = this.imgTrueHeight / this.imgTrueWidth;
    const domHwRatio = this.imgDomHeight / this.imgDomWidth;

    if (Math.abs(naturalhwRatio - domHwRatio) > 0.05) {
      //float error, so do not use === here
      //the ratio cannot display the full image
      this.pickBestHw();
    } else if (widthRatio > 1) {
      //too wide
      this.pickBestHw();
    } else if (heighthRatio > 1) {
      //too high
      this.pickBestHw();
    } else if (this.imgDomHeight < MIN_HEIGHT) {
      //too short
      this.pickBestHw();
    } else if (this.imgDomWidth < MIN_WIDTH) {
      //too narrow
      this.pickBestHw();
    }
  }

  pickBestHw() {
    const maxHeight = this.getMaxHeight();
    const maxWidth = this.getMaxWidth();

    //make sure both width and height 
    let newHeight = Math.min(this.imgTrueHeight, maxHeight);
    newHeight = Math.max(newHeight, MIN_HEIGHT);
    const calculatedWidth = newHeight / this.imgTrueHeight * this.imgTrueWidth;
    const set1 = [newHeight, calculatedWidth];

    let newWidth = Math.min(this.imgTrueWidth, maxWidth);
    newWidth = Math.max(newWidth, MIN_WIDTH);
    const calculatedHeight = newWidth / this.imgTrueWidth * this.imgTrueHeight;
    const set2 = [calculatedHeight, newWidth];

    //I would rather small than bigger
    //max dimension is more important than min dimension
    if (set1[0] <= maxHeight && set1[1] <= maxWidth) {
      this.applyHWSetToImage(set1);
    } else if (set2[0] <= maxHeight && set2[1] <= maxWidth) {
      this.applyHWSetToImage(set2);
    } else if (set1[0] <= maxHeight) {
      this.applyHWSetToImage(set1);
    } else {
      this.applyHWSetToImage(set2);
    }
  }

  applyHWSetToImage(set) {
    this.applyHWToImage(set[0], set[1]);
  }

  applyHWToImage(height, width) {
    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    if (!imageDom) {
      return;
    }

    this.imgDomWidth = width;
    this.imgDomHeight = height;

    imageDom.setAttribute("height", this.imgDomHeight);
    imageDom.setAttribute("width", this.imgDomWidth);

    this.makeTwoImageSameHeight();
  }

  onwheel(e) {
    const CHANGE_RATE = 1.05;
    const delta = -e.deltaY || e.wheelDelta;
    const newHeight = delta > 0 ? this.imgDomHeight * CHANGE_RATE : this.imgDomHeight / CHANGE_RATE;
    const newWidth = newHeight / this.imgTrueHeight * this.imgTrueWidth;

    this.zoom_scale = newHeight / this.imgTrueHeight;

    this.applyHWToImage(newHeight, newWidth);
    e.preventDefault && e.preventDefault();
  }

  makeTwoImageSameHeight() {
    if (this.shouldTwoPageMode()) {
      let imageDom = ReactDOM.findDOMNode(this.nextImgRef);
      imageDom && imageDom.setAttribute("height", this.imgDomHeight);
    }
  }

  rotateImg(newAngle) {
    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    if (imageDom) {
      if (_.isNumber(newAngle)) {
        this.rotateAngle = newAngle;
      } else {
        this.rotateAngle = (this.rotateAngle || 0) + 90;
      }

      this.rotateAngle = this.rotateAngle%360;

      imageDom.setAttribute("style", "transform: rotate(" + this.rotateAngle + "deg)");
      //TODO adjust height 
    }
  }

  bindUserInteraction() {
    this._handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);

    if (this.hasMusic() || isMobile()) {
      return;
    }

    const imageDom = ReactDOM.findDOMNode(this.wrapperRef);
    if (!imageDom) {
      return;
    }

    this.imgDomHeight = imageDom.clientHeight;
    imageDom.addEventListener("wheel", this.onwheel.bind(this), { passive: false });

    const that = this;
    $(imageDom).on({
      'mousemove': function (e) {
        that.clicked && that.updateScrollPos(e);
        e.preventDefault();
      },
      'mousedown': function (e) {
        that.clicked = true;
        that.clickY = e.pageY;
        that.clickX = e.pageX;
        e.preventDefault();
      },
      'mouseup': function (e) {
        that.clicked = false;
        // $('html').css('cursor', 'auto');
        e.preventDefault();
      }
    });
  }

  isImgFolder() {
    return !util.isCompress(this.getTextFromQuery())
  }

  async sendRequest() {
    const fp = this.getTextFromQuery();
    const api = this.isImgFolder() ? "/api/listImageFolderContent" : "/api/extract";
    let res = await Sender.postWithPromise(api, { filePath: fp, startIndex: this.state.index || 0 });
    this.handleRes(res);

    // let res2 = await Sender.postWithPromise("/api/getEhentaiMetaData", { filePath: fp });
    // if (!res2.isFailed()) {
    //   this.setState({
    //     ehentai_metadata: res2.json
    //   })
    // }
  }

  async handleRes(res) {
    this.res = res;
    if (!res.isFailed()) {
      let { zipInfo, path, stat, imageFiles, musicFiles, videoFiles, mecab_tokens, outputPath } = res.json;
      imageFiles = imageFiles || [];
      musicFiles = musicFiles || [];
      videoFiles = videoFiles || [];

      //files name can be 001.jpg, 002.jpg, 011.jpg, 012.jpg
      //or 1.jpg, 2.jpg 3.jpg 1.jpg
      //todo: the sort is wrong for imgFolder
      sortFileNames(imageFiles);
      sortFileNames(musicFiles);
      sortFileNames(videoFiles);

      this.setState({ imageFiles, musicFiles, videoFiles, path, fileStat: stat, zipInfo, mecab_tokens, outputPath },
        () => { this.bindUserInteraction() });
    } else {
      this.askRerender();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this._handleKeyDown);
    window && window.removeEventListener("resize", this._adjustImageSize);
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    const isRightAsNext = clientUtil.isRightAsNext();
    if (key === "arrowright" || key === "d" || key === "l") {
      if(isRightAsNext){
        this.next();
      }else{
        this.prev();
      }
      event.preventDefault();
    } else if (key === "arrowleft" || key === "a" || key === "j") {
      if(isRightAsNext){
        this.prev();
      }else{
        this.next();
      }
      event.preventDefault();
    } else if (key === "+" || key === "=") {
      this.onwheel({ wheelDelta: 1 })
    } else if (key === "-") {
      this.onwheel({ wheelDelta: -1 })
    }else if(key == "g"){
      this.onClickPagination();
    }else if(key == "x"){
      clientUtil.triggerClickOnClass("move-to-no-good-button");
    }else if(key == "v"){
      clientUtil.triggerClickOnClass("move-to-no-good-button");
    }else if(key == "arrowUp" || key == "w"){
      clientUtil.scrollPageByDistance(-50);
    }else if (key == "arrowDown" || key == "s"){
      clientUtil.scrollPageByDistance(50);
    }
  }

  toggleTwoPageMode() {
    const clipOrder = [NO_TWO_PAGE, TWO_PAGE_RIGHT, TWO_PAGE_LEFT];
    let next = clipOrder.indexOf(this.state.twoPageMode) + 1;
    if (next >= clipOrder.length) {
      next = 0;
    }
    this.setState({
      twoPageMode: clipOrder[next]
    });
  }

  getLastIndex() {
    return (this.state.imageFiles || []).length - 1;
  }

  hideSpinner() {
    clearTimeout(this._spinner_timer);
    document.querySelector(".one-book-img-load-spinner").classList.remove("show");
  }

  showSpinner() {
    //debounce
    clearTimeout(this._spinner_timer);
    this._spinner_timer = setTimeout(() => {
      document.querySelector(".one-book-img-load-spinner").classList.add("show");
    }, 500);
  }

  changePage(index, event) {
    event && event.preventDefault();
    event && event.stopPropagation();

    if (!userConfig.keep_clip) {
      this.setState({ twoPageMode: NO_TWO_PAGE });
    }
    this.showSpinner();
    this.setState({ index: index });
    this.setIndex(index);
    this.rotateImg(0);

    // //https://stackoverflow.com/questions/4210798/how-to-scroll-to-top-of-page-with-javascript-jquery
    // document.body.scrollTop = document.documentElement.scrollTop = 0;
    $(window).scrollTop(0);
  }

  getImageLength() {
    return this.state.imageFiles.length;
  }

  next(event) {
    if (this.getImageLength() <= 1) {
      return;
    }

    const jump = userConfig.keep_clip && this.shouldTwoPageMode() ? 2 : 1;
    let index = this.state.index + jump;
    if (index > this.getLastIndex()) {
      index = 0;
    }
    this.changePage(index, event);
  }

  prev(event) {
    if (this.getImageLength() <= 1) {
      return;
    }
    const jump = userConfig.keep_clip && this.shouldTwoPageMode() ? 2 : 1;
    let index = this.state.index - jump;
    if (index < 0) {
      index = this.getLastIndex();
    }
    this.changePage(index, event);
  }

  isFailedLoading() {
    return this.res && this.res.isFailed();
  }

  onClickPagination(event) {
    let index = prompt("Which page to go ");
    index = parseInt(index);
    if (_.isNumber(index) && !isNaN(index)) {
      //the real index 
      index = index - 1;
      if (index > this.getLastIndex()) {
        index = this.getLastIndex();
      }
      this.changePage(index, event);
    }
  }

  renderPagination() {
    if (isMobile()) { return; }
    const { imageFiles, index } = this.state;
    const isLast = index + 1 === this.getImageLength();
    const text = (index + 1) + "/" + this.getImageLength();
    const cn = classNames("one-book-foot-index-number", {
      "is-last": isLast
    })
    return <div className={cn}>{text}</div>;
  }

  renderFileSizeAndTime() {
    const { fileStat, imageFiles, index, zipInfo, videoFiles } = this.state;

    const fileSize = (fileStat?.size) || null;
    const fileDate = (fileStat?.mtimeMs) || null;
    
    let avgFileSize = 0; // 和explore的getPageAvgSize(e)是重复逻辑？
    if(this.hasImage()){
      if (zipInfo) {
        avgFileSize = zipInfo.totalImgSize / zipInfo.pageNum;
      } else if(fileSize) {
        avgFileSize = fileSize / this.getImageLength();
      }
      if(avgFileSize == Infinity){
        avgFileSize = 0;
      }
    }

    const rows = [];
    if(fileDate){
      const mTime = clientUtil.dateFormat_ymd(new Date(fileDate));
      rows.push(["Modify Time", mTime]);
    }
    if(fileSize){
      const size = filesizeUitl(fileSize);
      rows.push(["Total Size", size]);
    }
    if(this.hasImage()){
      const title = getBaseName(imageFiles[index]);
      rows.push(["Image Name", title]);
   
      const avg = filesizeUitl(avgFileSize);
      rows.push(["Average Image Size", avg]);
   
      rows.push(["Dimensions"]);
    }

    if(rows.length == 0){
      return 0;
    }

    const texts = rows.map((row, ii) => {
      let title = row[0];
      let text = row[1];

      if(title == "Image Name"){
        title = `${title}: ${text}`;
        text = util.truncateString(text, 30);
      }

      return (
      <div className={title === "Dimensions" ? "dimension-tag" : ""}
        key={ii} style={{ marginLeft: "15px" }} title={title}> {text}
      </div>);
    } );

    const mobilePageNum = (<div className="mobile-page-num"
      onClick={this.onClickPagination.bind(this)} >
      {`${index + 1}/${this.getImageLength()}`}  </div>);

    const videoNum = videoFiles.length > 0 && (<div className="video-num"> {` video: ${videoFiles.length}`}  </div>);
    return (<div className={"one-book-file-stat"}>{texts} {mobilePageNum} {videoNum} </div>);
  }

  shouldTwoPageMode() {
    return this.state.index < this.getLastIndex() && (this.state.twoPageMode === TWO_PAGE_LEFT || this.state.twoPageMode === TWO_PAGE_RIGHT);
  }

  onImageError() {
    // https://stackoverflow.com/questions/5559578/having-links-relative-to-root
    this.imgRef.src = "/error_loading.png";
    this.hideSpinner()
  }

  onImgLoad() {
    this.hideSpinner();

    this.adjustImageSize();
  }

  renderPreload(){
    const result = [];
    if(document.visibilityState === 'visible'){
      const { imageFiles, index, twoPageMode } = this.state;
      const beg = index + 1;
      const preload_num = 4;
      const end = Math.min(beg + preload_num, this.getImageLength())
  
      for(let ii = beg; ii < end; ii++){
        const temp =  <link rel="preload" key={ii} href={getFileUrl(imageFiles[ii])} as="image" />
        result.push(temp);
      }
    }
    return result;
  }

  renderImage() {
    const { imageFiles, index, twoPageMode } = this.state;
    if (!this.hasImage()) {
      if (this.hasMusic()) {
        return (<i className="fas fa-headphones-alt placeholder-for-music"></i>)
      } else {
        return;
      }
    }

    if (!isMobile()) {
      const cn = classNames("one-book-image", {
        "has-music": this.hasMusic()
      });

      const nextImg = this.shouldTwoPageMode() && <img className={cn} src={getFileUrl(imageFiles[index + 1])} alt="book-image"
        ref={img => this.nextImgRef = img}
        onLoad={this.makeTwoImageSameHeight.bind(this)}
        index={index + 1}
      />;

      const preload = this.renderPreload();

      return (<React.Fragment>
        <Spinner className="one-book-img-load-spinner" />
        {twoPageMode === TWO_PAGE_RIGHT && nextImg}
        <BookImage
          className={cn}
          alt="book-image"
          ref={img => this.imgRef = img}

          imageFiles={imageFiles}
          index={index}
          onError={this.onImageError.bind(this)}
          onLoad={this.onImgLoad.bind(this)}
          loading="lazy"
        />
        {twoPageMode === TWO_PAGE_LEFT && nextImg}
        {/* {preload} */}
      </React.Fragment>);
    } else {
      let images;
      const cn = classNames("mobile-single-image", {
        "has-music": this.hasMusic()
      });
      images = (<div className="mobile-single-image-container"
        ref={(e) => this.imgContainerRef = e}
        onClick={this.onClickMobileOneImageContainer.bind(this)}>
        <img className={cn}
          ref={(img) => this.imgRef = img}
          onError={this.onImageError.bind(this)}
          onLoad={this.onImgLoad.bind(this)}
          src={getFileUrl(imageFiles[index])} />
      </div>);
      return (<div className="mobile-one-book-container">
        <Spinner className="one-book-img-load-spinner" />
        {images}
      </div>);
    }
  }

  onClickMobileOneImageContainer(event) {
    var x = event.pageX;
    var y = event.pageY;

    // console.log(y);
    const dom = ReactDOM.findDOMNode(this.imgContainerRef);
    const width = dom.clientWidth;
    const height = dom.clientHeight;

    const upperRange = 300;  //use the fixed upper range is more comportable

    const posX = x > width / 2;
    const posY = y > upperRange;

    const isRightAsNext = clientUtil.isRightAsNext();
    if(isRightAsNext){
      if (posX) {
        this.next();
      } else {
        this.prev();
      }
    }else{
      if (posX) {
        this.prev();
      } else {
        this.next();
      }
    }

    event.preventDefault();
  }

  renderOverviewLink() {
    if (!this.state.path) {
      return;
    }
      
    if(!this.hasImage()){
        const toUrl3 = clientUtil.getExplorerLink(this.state.outputPath || this.state.path);
        return (
          <div className="one-book-overview-path">
            <Link to={toUrl3}> Explorer </Link>
          </div>);
      }else{
        const toUrl = clientUtil.getOneBookOverviewLink(this.state.path);
        const toUrl2 = clientUtil.getOneBookWaterfallLink(this.state.path);
        const toUrl3 = clientUtil.getExplorerLink(this.state.outputPath || this.state.path);
    
        return (
          <div className="one-book-overview-path">
            <Link to={toUrl}> Overview </Link>
            <Link to={toUrl2}> Waterfall </Link>
            <Link to={toUrl3}> Explorer </Link>
          </div>);
    }
  }

  renderPath() {
    if (!this.state.path) {
      return;
    }

    const parentPath = getDir(this.state.path);
    const toUrl = clientUtil.getExplorerLink(parentPath);

    // let link2;
    // if(this.isImgFolder()){
    //   const dir = this.getTextFromQuery();
    //   const toDirUrl = clientUtil.getExplorerLink(dir);
    //   link2 = (<Link to={toDirUrl} className="folder-link"> <div className="far fa-folder"/></Link>)
    // }

    return (
      <div className="one-book-path">
        <Link to={toUrl}>{parentPath} </Link>
      </div>);
  }

  renderToolbar() {
    if (!this.state.path) {
      return;
    }
    const toolbar = <FileChangeToolbar
      isFolder={this.isImgFolder()}
      bigFont={true}
      className="one-book-toolbar"
      file={this.state.path}
      popPosition={"top-center"}
      onNewPath={this.onNewPath.bind(this)} />;
    return toolbar;
  }

  onNewPath(res) {
    let newPath = res.json.dest;
    const { path } = this.state;

    const oldP = encodeURIComponent(path);
    const newP = encodeURIComponent(newPath);

    //change url 
    if (newPath) {
      const newUrl = location.href.replace(oldP, newP);
      window.history.pushState({}, null, newUrl);
      this.setState({
        path: newPath
      });
    }
  }

  hasMusic() {
    const { musicFiles } = this.state;
    return musicFiles.length > 0;
  }

  hasImage() {
    return this.getImageLength() > 0;
  }

  renderMusicPlayer() {
    if (this.hasMusic()) {
      let { musicFiles } = this.state;

      const cn = classNames({
        "only-music": !this.hasImage()
      })

      return <MusicPlayer className={cn} audioFiles={musicFiles} />;
    }
  }

  renderTags() {
    const fn = getBaseName(this.getTextFromQuery());
    const dirName = getBaseName(getDir(this.getTextFromQuery()));

    //the folder name can be be the author name
    if (fn.includes(dirName)) {
      const tag = dirName;
      const url = clientUtil.getSearhLink(tag);
      let tagDiv = (<div key={tag} className="one-book-foot-author" >
        <Link target="_blank" to={url} key={tag}>{tag}</Link>
      </div>);
      return (<div className="one-book-tags">{tagDiv}</div>);
    } else {
      return null;
    }
  }


  renderNextPrevButton() {
    if (isMobile()) {
      return;
    }

    let leftFunc;
    let rightFunc;
    const isRightAsNext = clientUtil.isRightAsNext();
    if(isRightAsNext){
      rightFunc= this.next.bind(this);
      leftFunc = this.prev.bind(this)
    }else{
      leftFunc = this.next.bind(this);
      rightFunc = this.prev.bind(this)
    }

    return (
      <React.Fragment>
        <div className="big-column-button next"> <i className="fas fa-arrow-circle-right" onClick={rightFunc}></i> </div>
        <div className="big-column-button prev"> <i className="fas fa-arrow-circle-left" onClick={leftFunc}></i>  </div>
      </React.Fragment>
    );
  }

  renderSecondBar() {
    let content;
    if (!isMobile()) {
      content = (
        <React.Fragment>
          <div className="two-page-mode-button fas fa-arrows-alt-h" onClick={this.toggleTwoPageMode.bind(this)} title="two page mode"></div>
          <div className="fas fa-sync-alt rotate-button" title="rotate image" onClick={this.rotateImg.bind(this)}></div>
        </React.Fragment>);
    }
    return (<div className="one-book-second-toolbar">
      {content}
    </div>);
  }

  // renderEhentaiTag() {
  //   const { imageFiles, index, musicFiles, ehentai_metadata } = this.state;
  //   if (ehentai_metadata && ehentai_metadata.length > 0) {
  //     console.log(ehentai_metadata);
  //     //temp
  //     const entry = ehentai_metadata[0];
  //     const display_tags = [
  //       "parody",
  //       "character",
  //       "female",
  //     ];

  //     return display_tags.map(e => {
  //       const subtags = entry[e];
  //       if (subtags && subtags.length > 0) {
  //         const subtagDivs = subtags.map(tt => {
  //           const url = clientUtil.getTagLink(tt);
  //           let tagDiv = (<div key={tt} className="ehentai-tag-link" >
  //             <Link target="_blank" to={url} key={tt}>{tt}</Link>
  //           </div>);
  //           return tagDiv;
  //         })
  //         return (<div key={e} className="ehentai-tag-row">{subtagDivs}</div>);
  //       }
  //     })
  //   }
  // }

  render() {
    if (this.isFailedLoading()) {
      const fp = this.getTextFromQuery();
      return <ErrorPage res={this.res} filePath={fp} />;
    }

    const {  index, imageFiles, musicFiles, videoFiles, mecab_tokens } = this.state;
    const bookTitle = (<div className="one-book-title" >
      <FileNameDiv mecab_tokens={mecab_tokens} filename={getBaseName(this.state.path)} />
      {this.renderPath()}
    </div>);

    if (_.isEmpty(imageFiles) && _.isEmpty(musicFiles) && _.isEmpty(videoFiles)) {
      if (this.res && !this.res.isFailed()) {
        return (<h3>
          <center style={{ paddingTop: "200px" }}>
            <div className="alert alert-warning col-6" role="alert" > No image or music or video file </div>
            {bookTitle}
            {this.renderTags()}
            {this.renderToolbar()}
          </center>
        </h3>);
      } else {
        return (<CenterSpinner text={this.getTextFromQuery()} splitFilePath />);
      }
    }

    if (this.state.path) {
      document.title = getBaseName(this.state.path);

      if (isMobile() && index > 0) {
        const _text = `${index + 1}/${this.getImageLength()}`;
        document.title = _text + " " + document.title;
      }
    }

    const wraperCn = classNames("one-book-wrapper", {
      "full-screen": screenfull.isFullscreen,
      "has-music": this.hasMusic(),
      "two-page-mode": this.shouldTwoPageMode()
    });

    const content = (<div className={wraperCn} ref={wrapper => this.wrapperRef = wrapper}>
      {this.renderImage()}
      {this.renderMusicPlayer()}
    </div>);


    return (
      <div className="one-book-container">
        {content}
        {bookTitle}
        {this.renderPagination()}
        {this.renderFileSizeAndTime()}
        {this.renderTags()}
        {this.renderToolbar()}
        {this.renderNextPrevButton()}
        {this.renderSecondBar()}
        {this.renderOverviewLink()}
        {/* {this.renderEhentaiTag()} */}
        <HistorySection filePath={this.state.path} />
      </div>
    );
  }
}

OneBook.contextType = GlobalContext;
OneBook.propTypes = {
};
