import React, { Component } from 'react';
import _ from 'underscore';
const nameParser = require('../name-parser');
const classNames = require('classnames');
const dateFormat = require('dateformat');

import { Link } from 'react-router-dom';
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
const spop  = require("./subcomponent/spop");
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import ScrollZoomer from './subcomponent/ScrollZoomer';
import LoadingImage from './LoadingImage';
import MusicPlayer from './MusicPlayer';

const util = require("../util");
const queryString = require('query-string');
const stringHash = util.stringHash;
const filesizeUitl = require('filesize');
import screenfull from 'screenfull';
const getUrl = util.getUrl;
const Constant = require("../constant");

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      musicFiles: [],
      index: this.getInitIndex()
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

    screenfull.onchange(()=> this.forceUpdate());
  }
  
  componentDidUpdate() {
    this.componentDidMount();
  }
  
  displayFile(file){
    Sender.post("/api/extract", {fileName: this.getPathFromLocalStorage(),   hash: this.getHash() }, res => {
      this.res = res;
      if (!res.failed) {
        this.loadedHash = this.getHash();
        let files = res.files || [];

        //files name can be 001.jpg, 002.jpg, 011.jpg, 012.jpg
        //or 1.jpg, 2.jpg 3.jpg 1.jpg
        //the sort is trigger

        util.sortFileNames(files);

        let musicFiles = res.musicFiles || [];
        util.sortFileNames(musicFiles);

        this.setState({ files, musicFiles, path:res.path, fileStat: res.stat });
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
      }else{
        this.failTimes++;
        this.forceUpdate();
      }
    });
  }
  
  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }
  
  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowright" || key === "d" || key === "l") {
      this.changePage(this.state.index + 1);
    } else if (key === "arrowleft" || key === "a" || key === "j") {
      this.changePage(this.state.index - 1);
    }
  }
  
  changePage(index) {
    const lastIndex = (this.state.files || []).length - 1;
    if (index < 0) {
      //do nothing
    } else if (index > lastIndex) {
      spop({
        template: 'Last Page',
        position: 'top-right',
        autoclose: 3000
      });
    }else{
      this.setState({ index });
      this.setIndex(index);

      // //https://stackoverflow.com/questions/4210798/how-to-scroll-to-top-of-page-with-javascript-jquery
      // document.body.scrollTop = document.documentElement.scrollTop = 0;
    }
  }
  
  next(event) {
    let index = parseInt(event.target.getAttribute("index")) + 1;
    event.preventDefault();
    this.changePage(index);
    this.scrollZoomer.reset();
  }
  
  prev(event) {
    let index = parseInt(event.target.getAttribute("index")) - 1;
    event.preventDefault();
    this.changePage(index);
    this.scrollZoomer.reset();
  }
  
  isFailedLoading(){
    return this.res && this.res.failed;
  }

  renderPagination() {
    if(_.isPad()){ return; }
    const { files, index } = this.state;
    const isLast = index+1 === files.length;
    const text = (index+1) + "/" + files.length;
    const cn = classNames("one-book-foot-index-number", {
      "is-last": isLast
    })
    return <div className={cn}>{text}</div>;
  }

  renderFileSizeAndTime(){
    if (this.state.fileStat) {
      const size = filesizeUitl(this.state.fileStat.size, {base: 2});
      const mTime = dateFormat(this.state.fileStat.mtime, "isoDate");
      const { files, index } = this.state;
      const title = util.getFn(files[index], "/" );
      const text = [mTime, size, title].map(e => <div key={e} style={{marginLeft:"15px"}}> {e} </div>)
      return <div className={"one-book-file-stat"}>{text} </div>
    }
  }

  renderImage(){
    const { files, index } = this.state;
    if(!_.isPad()){
      const cn = classNames("one-book-image", {
        "has-music": this.hasMusic()
      });
      return <img  className={cn} src={getUrl(files[index])} alt="book-image"
                   onClick={this.next.bind(this)}
                   onContextMenu={this.prev.bind(this)}
                   index={index}
                   />
    } else {
      const images = files.map(file => {
        return <LoadingImage className={"mobile-one-book-image"} 
                             bottomOffet={-4000}
                             topOffet={-3000}
                             url={getUrl(file)} 
                             key={file}/>
      });

      return (<div className="mobile-one-book-container">
                {images}
            </div>);
    }
  }

  renderPath() {
    if (!this.state.path) {
      return;
    }

    const parentPath = _.getDir(this.state.path);
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
    const toolbar = !_.isPad() && <FileChangeToolbar className="one-book-toolbar" file={this.state.path} popPosition={"top-center"}/>;
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
    const result = nameParser.parse(_.getFn(this.state.path));
    const author = result && result.author;
    let tags = (result && result.tags)||[];
    //temp
    tags = author? tags.concat(author): tags;
    
    const tagDivs = tags.length > 0 && tags.map((tag)=>{
      const tagHash = stringHash(tag);
      let url = tag === author? ("/author/" + tagHash) : ("/tag/" + tagHash);
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

  onTitleClick(){
    //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
    var textArea = document.createElement("textarea");
    textArea.value = _.getFn(this.state.path)
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();
   
    spop({
      template: 'Copied to Clipboard',
      position: 'bottom-right',
      autoclose: 3000
    });
  }

  render() {
    if (this.isFailedLoading()) { 
      return <ErrorPage res={this.res.res}/>;
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
      document.title = _.getFn(this.state.path);
    }

    const wraperCn = classNames("one-book-wrapper", {
      "full-screen": screenfull.isFullscreen
    });

    return (  
      <div className="one-book-container">
        <div className={wraperCn}>
          {this.renderImage()}
          {this.renderMusicPlayer()}
        </div>
        <div className="one-book-title" >
            {this.renderPath()} 
            <span onClick={this.onTitleClick.bind(this)} className="one-book-title-filename">{_.getFn(this.state.path)} </span>
        </div>
        {this.renderPagination()}
        {this.renderFileSizeAndTime()}
        {this.renderTags()}
        {this.renderToolbar()}
        <ScrollZoomer ref={scrollZoomer => this.scrollZoomer = scrollZoomer} />
        {/* {this.renderToggleFullScreenButton()}  */}
      </div>
    );
  }
}

OneBook.propTypes = {
};
