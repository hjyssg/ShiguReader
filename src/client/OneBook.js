import React, { Component } from 'react';
import _ from 'underscore';
const nameParser = require('../name-parser');
const classNames = require('classnames');
const dateFormat = require('dateformat');
import ReactDOM from 'react-dom';

import { Link } from 'react-router-dom';
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import ClickAndCopyText from './subcomponent/ClickAndCopyText';
const spop  = require("./subcomponent/spop");
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import LoadingImage from './LoadingImage';
import MusicPlayer from './MusicPlayer';
import $ from 'jquery'
import "./style/BigColumnButton.scss";

const util = require("../util");
const queryString = require('query-string');
const filesizeUitl = require('filesize');
import screenfull from 'screenfull';
const Constant = require("../constant");

const MIN_HEIGHT = 400;
const MIN_WIDTH = 400;
const userConfig = require('../user-config');
const clientUtil = require("./clientUtil");
const { getDir, getFn, isPad, stringHash, getUrl, sortFileNames } = clientUtil;

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      musicFiles: [],
      index: this.getInitIndex(),
      twoPageMode: "no-clip"
    };
    this.failTimes = 0;
  }

  getInitIndex(){
    const parsed = queryString.parse(location.hash);
    return parseInt(parsed.index) || 0;
  }

  setIndex(index){
    location.hash = queryString.stringify({index});
  }

  getHash(){
    return this.props.match.params.number;
  }
  
  componentDidMount() {
    const file = this.getHash();
    if(file && this.loadedHash !== file && this.failTimes < 3){
      this.displayFile(file);
    }

    if(!isPad ()){
      screenfull.onchange(()=> {
        this.forceUpdate();
      });
     }

    window.addEventListener("resize", this.adjustImageSizeAfterResize.bind(this));
  }
  
  componentDidUpdate() {
    this.componentDidMount();
  }

  updateScrollPos(e) {
    // $('html').css('cursor', 'row-resize');
    // console.log(this.clickY, e.pageY, this.clickY - e.pageY );
    const ADJUSTER = 1.05;
    let change = $(window).scrollTop() + (this.clickY - e.pageY) * ADJUSTER;
    $(window).scrollTop(change);
    // console.log(change)
  }

  adjustImageSizeAfterResize(){
    this.adjustImageSize();
  }

  getMaxHeight(){
    if(isPad()){
      return window.screen.height - 10;
     }

    let maxHeight = 952;
    if (this.hasMusic()){
      maxHeight = 450;
    } else {
      maxHeight = isNaN(window.innerHeight) ? window.clientHeight : window.innerHeight;
    }
    return maxHeight - 10;
  }

  getMaxWidth(){
    if(isPad()){
     return window.screen.width;
    }
    const result = isNaN(window.innerWidth) ? window.clientWidth : window.innerWidth;
    return result - 50;
  }

  adjustImageSize(){
    if(isPad()){
      return;
    }

    this.loadedImage = this.state.index;
    const imageDom = ReactDOM.findDOMNode(this.imgRef);
    this.imgDomHeight = imageDom.clientHeight; 
    this.imgDomWidth =  imageDom.clientWidth; 
    this.imgTrueHeight = imageDom.naturalHeight;
    this.imgTrueWidth = imageDom.naturalWidth;


    //display img's real px number
    const dimDom = document.getElementsByClassName("dimension-tag")[0];
    dimDom.textContent = `${imageDom.naturalWidth}×${imageDom.naturalHeight}`;

    this.clicked = false;
    this.clickY = 0;

    //set max height
    const maxHeight = this.getMaxHeight();
    const maxWidth = this.getMaxWidth();

    const widthRatio = this.imgDomWidth / maxWidth;
    const heighthRatio = this.imgDomHeight / maxHeight;

    const naturalhwRatio = this.imgTrueHeight/this.imgTrueWidth;
    const domHwRatio = this.imgDomHeight / this.imgDomWidth;

    if(Math.abs(naturalhwRatio - domHwRatio) > 0.05) {  
      //float error, so do not use === here
      //the ratio cannot display the full image
      
      //make sure both width and height 
      let newHeight = Math.min(imageDom.naturalHeight, maxHeight);
      newHeight = Math.max(newHeight, MIN_HEIGHT);
      this.applyHeightToImage(newHeight);

      let newWidth = Math.min(imageDom.naturalWidth, maxWidth);
      newWidth = Math.max(newWidth, MIN_WIDTH);
      this.applyWidthToImage(newWidth);

    }else if(widthRatio > 1 && widthRatio > heighthRatio){
      //too wide
      this.applyWidthToImage(maxWidth);
    }else if(heighthRatio > 1) {
      //too high
      this.applyHeightToImage(maxHeight);
    }else if(this.imgDomHeight < MIN_HEIGHT){
      //too short
      this.applyHeightToImage(MIN_HEIGHT);
    }else if(this.imgDomWidth < MIN_WIDTH){
      //too narrow
      this.applyWidthToImage(MIN_WIDTH);
    }
  }

  //always check min_width, min_height
  //only check max_width, max_height when change page or reload

  applyWidthToImage(width){
    if(width < MIN_WIDTH){
      return;
    }

    const newH = (width/this.imgTrueWidth) * this.imgTrueHeight;
    if(newH > this.getMaxHeight() || newH < MIN_HEIGHT){
      return;
    }
 
    this.applyHWToImage(newH, width);
  }

  applyHeightToImage(height, skipMaxChecking){
    if(height < MIN_HEIGHT ){
      return;
    }
    const newW = (height/this.imgTrueHeight) * this.imgTrueWidth;
    if((!skipMaxChecking && newW > this.getMaxWidth()) || newW < MIN_WIDTH){
      return;
    }
    this.applyHWToImage(height, newW);
    this.makeTwoImageSameHeight();
  }

  applyHWToImage(height, width){
    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    if(!imageDom){
      return;
    }

    this.imgDomWidth = width;
    this.imgDomHeight = height;

    imageDom.setAttribute("height", this.imgDomHeight);
    imageDom.setAttribute("width", this.imgDomWidth);
  }

  onwheel(e){
    const CHANGE_RATE = 1.05;
    const delta = -e.deltaY || e.wheelDelta;
    const newHeight = delta > 0?  this.imgDomHeight * CHANGE_RATE : this.imgDomHeight / CHANGE_RATE;
    this.applyHeightToImage(newHeight, true);
    e.preventDefault && e.preventDefault();
  }

  makeTwoImageSameHeight(){
    if(this.state.twoPageMode){
      let imageDom = ReactDOM.findDOMNode(this.nextImgRef);
      imageDom && imageDom.setAttribute("height", this.imgDomHeight);
    }
  }

  rotateImg(newAngle){
    let imageDom = ReactDOM.findDOMNode(this.imgRef);
    if(imageDom){
      if(typeof newAngle === "number"){ 
        this.rotateAngle = newAngle;
      }else{
        this.rotateAngle = (this.rotateAngle||0) + 90;
      }
      imageDom.setAttribute("style", "transform: rotate(" + this.rotateAngle + "deg)");
    }
  }

  bindUserInteraction(){
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    if(this.hasMusic() || isPad()){
      return;
    }

    const imageDom = ReactDOM.findDOMNode(this.wrapperRef);
    this.imgDomHeight = imageDom.clientHeight;
    imageDom.addEventListener("wheel", this.onwheel.bind(this), {passive: false} );

    const that = this;
    $(imageDom).on({
      'mousemove': function(e) {
          that.clicked && that.updateScrollPos(e);
          e.preventDefault();
      },
      'mousedown': function(e) {
          that.clicked = true;
          that.clickY = e.pageY;
          e.preventDefault();
      },
      'mouseup': function(e) {
          that.clicked = false;
          // $('html').css('cursor', 'auto');
          e.preventDefault();
      }
    });
  }
  
  displayFile(file){
    Sender.post("/api/extract", {filePath: this.getPathFromLocalStorage(),   hash: this.getHash() }, res => {
      this.res = res;
      if (!res.failed) {
        this.loadedHash = this.getHash();
        let files = res.files || [];
        files = files.filter(e => {
          return !util.isCompressedThumbnail(e);
        })

        //files name can be 001.jpg, 002.jpg, 011.jpg, 012.jpg
        //or 1.jpg, 2.jpg 3.jpg 1.jpg
        //the sort is trigger

        sortFileNames(files);
        let musicFiles = res.musicFiles || [];
        sortFileNames(musicFiles);
        this.setState({ files, musicFiles, path:res.path, fileStat: res.stat });

        this.bindUserInteraction();
      }else{
        this.failTimes++;
        this.forceUpdate();
      }
    });
  }
  
  componentWillUnmount() {
    document && document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    window && window.removeEventListener("resize", this.adjustImageSizeAfterResize.bind(this));
  }
  
  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowright" || key === "d" || key === "l") {
      this.next();
      event.preventDefault();
    } else if (key === "arrowleft" || key === "a" || key === "j") {
      this.prev();
      event.preventDefault();
    } else if (key === "+" || key === "=" ) {
      this.onwheel({wheelDelta: 1})
    } else if (key === "-" ) {
      this.onwheel({wheelDelta: -1})
    }
  }

  toggleTwoPageMode(){
    const clipOrder = ["no-clip", "right", "left"];
    let next = clipOrder.indexOf(this.state.twoPageMode)+1;
    if(next >= clipOrder.length){
      next = 0;
    }
    next = clipOrder[next];
    this.setState({
      twoPageMode: next
    });
  }
  
  getLastIndex(){
    return (this.state.files || []).length - 1;
  }

  changePage(index, event) {
    event && event.preventDefault();
    event && event.stopPropagation();

    const lastIndex = this.getLastIndex();
    if (index < 0) {
      //do nothing
    } else if (index > lastIndex) {
      spop({
        template: 'Last Page',
        position: 'top-right',
        autoclose: 3000
      });
    }else{
      if(!userConfig.keep_clip){
        this.setState({ twoPageMode: undefined });
      }
      this.setState({ index: index});
      this.setIndex(index);
      this.rotateImg(0);


      // //https://stackoverflow.com/questions/4210798/how-to-scroll-to-top-of-page-with-javascript-jquery
      // document.body.scrollTop = document.documentElement.scrollTop = 0;

      $(window).scrollTop(0);
    }
  }
  
  
  next(event) {
    if(this.state.files.length <= 1){
      return;
    }

    const jump = userConfig.keep_clip && this.shouldTwoPageMode()? 2 : 1;
    let index = this.state.index + jump;
    index = Math.min(this.getLastIndex(), index);

    this.changePage(index, event);
  }
  
  prev(event) {
    if(this.state.files.length <= 1){
      return;
    }
    const jump = userConfig.keep_clip && this.shouldTwoPageMode()? 2 : 1;
    let index = this.state.index - jump;
    index = Math.max(0, index);
    this.changePage(index, event);
  }
  
  isFailedLoading(){
    return this.res && this.res.failed;
  }

  renderPagination() {
    if(isPad()){ return; }
    const { files, index } = this.state;
    const isLast = index+1 === files.length;
    const text = (index+1) + "/" + files.length;
    const cn = classNames("one-book-foot-index-number", {
      "is-last": isLast
    })
    return <div className={cn}>{text}</div>;
  }

  renderFileSizeAndTime(){
    const {fileStat,  files, index } = this.state;
    if (fileStat) {
      const size = filesizeUitl(fileStat.size, {base: 2});
      const avg = filesizeUitl(fileStat.size/files.length, {base: 2});
      const mTime = dateFormat(fileStat.mtime, "isoDate");
      const title = getFn(files[index], "/" );
      const dim = "";  //change by dom operation
      const titles = [
        "Modify Time",
        "Total Size",
        "Image Name",
        "Average Image Size",
        "Dimensions"
      ];

      const texts = [mTime, size, title, avg, dim].map((e, ii) => 
                    <div className={titles[ii] ==="Dimensions"? "dimension-tag": ""} 
                      key={e+ii} style={{marginLeft:"15px"}} title={titles[ii]}> {e} 
                    </div>);
      const mobilePageNum = isPad() && (
        <div  style={{marginLeft:"15px"}} > {`${index+1}/${files.length}`}  </div>
      )
      return <div className={"one-book-file-stat"}>{texts} {mobilePageNum} </div>
    }
  }

  shouldTwoPageMode(){
    return this.state.index < this.getLastIndex() && (this.state.twoPageMode === "left" || this.state.twoPageMode === "right");
  }

  renderImage(){
    const { files, index, twoPageMode } = this.state;
    if(!isPad()){
      const cn = classNames("one-book-image", {
        "has-music": this.hasMusic()
      });

      const nextImg = this.shouldTwoPageMode() &&  <img  className={cn} src={getUrl(files[index+1])} alt="book-image"
                                          ref={img => this.nextImgRef = img}
                                          onLoad={this.makeTwoImageSameHeight.bind(this)}
                                          index={index+1}
                                        />;

      // {index < files.length-1 &&  <link rel="preload" href={getUrl(files[index+1])} as="image" /> }
      // {index > 0 && <link rel="preload" href={getUrl(files[index-1])} as="image" />}
      return (<React.Fragment>
              { twoPageMode === "right" &&  nextImg }
              <img  className={cn} src={getUrl(files[index])} alt="book-image"
                           ref={img => this.imgRef = img}
                           onLoad={this.adjustImageSize.bind(this)}
                           index={index}
                           />
              { twoPageMode === "left" &&  nextImg }
              </React.Fragment>);    
    } else {
      let images;
      if(userConfig.onebook_only_image_per_page){
        const cn = classNames("mobile-single-image", {
          "has-music": this.hasMusic()
        });
        images = (<div className="mobile-single-image-container" 
                        ref={(e) =>  this.imgContainerRef = e}
                        onClick={this.onClickMobileOneImageContainer.bind(this)}> 
                <img className={cn} 
                  ref={(img) =>  this.imgRef = img}
                  src={getUrl(files[index])}  />
               </div>);
      }else{
        images =files.map(file => {
          return (<div key={file} className="mobile-one-book-image_array-container"> 
                      <LoadingImage className={"mobile-one-book-image"} 
                               bottomOffet={-4000}
                               topOffet={-3000}
                               url={getUrl(file)} 
                               key={file}/> 
                  </div>);
        });
      }

      return (<div className="mobile-one-book-container">
                {images}
            </div>);
    }
  }

  onClickMobileOneImageContainer(event){
    var x = event.pageX;
    var y = event.pageY;

    console.log(y);

    const dom = ReactDOM.findDOMNode(this.imgContainerRef);
    const width = dom.clientWidth;
    const height = dom.clientHeight;

    const upperRange = 300;  //use the fixed upper range is more comportable

    const posX = x > width/2;
    const posY = y > upperRange;

    if(posX){
      this.next();
    }else{
      this.prev();
    }

    event.preventDefault();
  }

  renderPath() {
    if (!this.state.path) {
      return;
    }

    const parentPath = getDir(this.state.path);
    const parentHash = stringHash(parentPath);
    const toUrl = ('/explorer/'+ parentHash);
    
    return (
      <div className="one-book-path">
        <Link to={toUrl}>{parentPath} </Link>
      </div>);
  }

  renderToolbar(){
    if (!this.state.path) {
      return;
    }
    const toolbar = !isPad() &&
  (<FileChangeToolbar showAllButtons className="one-book-toolbar" file={this.state.path} popPosition={"top-center"}/>);
    return toolbar;
  }

  hasMusic(){
    const {musicFiles} = this.state;
    return musicFiles.length > 0;
  }

  renderMusicPlayer(){
    if(this.hasMusic()){
      const {musicFiles} = this.state;

      return <MusicPlayer  audioFiles={musicFiles} />;
    }
  }

  renderTags(){
    const result = nameParser.parse(getFn(this.state.path));
    const author = result && result.author;
    const group = result && result.group;
    let tags = (result && result.tags)||[];
    if(author && group && group !== author){
      tags = tags.concat(group);
    }
    if(author){
      tags = tags.concat(author);
    }
    
    const tagDivs = tags.map((tag)=>{
      const tagHash = stringHash(tag);
      let url;
      if(tag === author){
        url = "/author/" + tagHash;
      }else if(tag === group){
        url = "/search/" + tag;
      }else{
        url = "/tag/" + tagHash;
      }
      
      url += "#sortOrder=" + Constant.SORT_BY_FOLDER;
      return (<div key={tag} className="one-book-foot-author" >
                <Link  target="_blank" to={url}  key={tag}>{tag}</Link>
              </div>);
    })

    return (<div className="one-book-tags">
            {tagDivs}
          </div>);
  }

  getPathFromLocalStorage(){
    const hash = this.getHash();
    return window.localStorage && window.localStorage.getItem(hash);
  }

  renderNextPrevButton(){
    if(isPad()){
      return;
    }

    return (
      <React.Fragment>
        <div className="big-column-button next"> <i className="fas fa-arrow-circle-right" onClick={this.next.bind(this)}></i> </div>
        <div className="big-column-button prev"> <i className="fas fa-arrow-circle-left" onClick={this.prev.bind(this)}></i>  </div>
      </React.Fragment>
    );
  }

  renderSecondBar(){
    if(isPad()){
      return;
    }
    return (<div className="one-book-second-toolbar">
              <div className="clip-with-prev-button fas fa-arrows-alt-h" onClick={this.toggleTwoPageMode.bind(this)} title="two page mode"></div>
              <div className="fas fa-sync-alt rotate-button" title="rotate image" onClick={this.rotateImg.bind(this)}></div>
            </div>);
  }

  render() {
    if (this.isFailedLoading()) { 
      let userText;
      if(this.res.res.status === 404){
        userText = `Does not find ${this.getPathFromLocalStorage()}.`;
      } else if (this.res.res.status === 500){
        userText = `${this.getPathFromLocalStorage()} is a broken file`;
      }

      return <ErrorPage res={this.res.res} userText={userText}/>;
    }
    
    const { files, index } = this.state;
    if (_.isEmpty(files)) {
      if(this.res && !this.refs.failed){
        return <h3><center>no content files</center></h3>;
      } else {
        return (<CenterSpinner text={this.getPathFromLocalStorage()} splitFilePath/>);
      } 
    }
    
    if(this.state.path){
      document.title = getFn(this.state.path);

      if(isPad() && index > 0){
        document.title = index.toString() + " " +  document.title;
      }
    }

    const wraperCn = classNames("one-book-wrapper", {
      "full-screen": screenfull.isFullscreen,
      "has-music": this.hasMusic(),
      "clip-with-prev": this.state.twoPageMode
    });

    const content = (<div className={wraperCn} ref={wrapper => this.wrapperRef = wrapper}>
                      {this.renderImage()}
                      {this.renderMusicPlayer()}
    </div>);

    const isContentBelow = isPad() && !userConfig.onebook_only_image_per_page;

    return (  
      <div className="one-book-container">
        {!isContentBelow && content}
        <div className="one-book-title" >
            {this.renderPath()} 
            <ClickAndCopyText text={getFn(this.state.path)} />
        </div>
        {this.renderPagination()}
        {this.renderFileSizeAndTime()}
        {this.renderTags()}
        {this.renderToolbar()}
        {this.renderNextPrevButton()}
        {this.renderSecondBar()}

        {isContentBelow && content}
      </div>
    );
  }
}

OneBook.propTypes = {
};
