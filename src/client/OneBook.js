import React, { Component } from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';
const nameParser = require('../name-parser');
import { Link } from 'react-router-dom';
import stringHash from "string-hash";
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
const spop  = require("./subcomponent/spop");
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
var classNames = require('classnames');
var dateFormat = require('dateformat');
import LoadingImage from './LoadingImage';
const util = require("../util");
import AudioPlayer from 'react-modular-audio-player';
import screenfull from 'screenfull';
const queryString = require('query-string');
const isOnlyDigit = nameParser.isOnlyDigit;

function getUrl(fn){
  return "../" + fn;
}

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
    Sender.post("/api/extract", {  hash: this.getHash() }, res => {
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
    }else if(key === "enter"){
      this.toggleFullScreen();
    }
  }
  
  changePage(index) {
    const lastIndex = (this.state.files || []).length - 1;
    if (index < 0) {
      return;
    } else if (index > lastIndex) {
      spop({
        template: 'Last Page',
        position: 'top-right',
        autoclose: 3000
      });
      return;
    }
    this.setState({ index });
    this.setIndex(index);
  }
  
  next(event) {
    let index = parseInt(event.target.getAttribute("index")) + 1;
    event.preventDefault();
    this.changePage(index);
  }
  
  prev(event) {
    let index = parseInt(event.target.getAttribute("index")) - 1;
    event.preventDefault();
    this.changePage(index);
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
      const size = Math.ceil(this.state.fileStat.size/ 1000000.0) + "MB";
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
    const toolbar = !_.isPad() && <FileChangeToolbar className="one-book-toolbar" file={this.state.path}/>;
    return toolbar;
  }

  hasMusic(){
    const {musicFiles} = this.state;
    return musicFiles.length > 0;
  }

  renderMusicPlayer(){
    if(this.hasMusic()){
      const {musicFiles} = this.state;
      let playlist = musicFiles.map(e => {
        return { src: getUrl(e), title: util.getFn(e, "/") }
      })
      return <AudioPlayer  audioFiles={playlist}
                           hideLoop={true}
                           playerWidth={"90%"}
                           iconSize={"1.5rem"}
                           fontWeight={"500"}
                           fontSize={"1.2rem"}/>;
    }
  }

  toggleFullScreen(){
    screenfull.toggle();
  }

  renderToggleFullScreenButton(){
    return <button className="fas fa-arrows-alt fs-toggle-button" title="Toggle Full Screen" onClick={this.toggleFullScreen.bind(this)}/>
  }

  renderTags(){
    const result = nameParser.parse(_.getFn(this.state.path));
    const author = result && result.author;
    let tags = (result && result.tags)||[];
    //temp
    tags = author? tags.concat(author): tags;
    
    const tagDivs = tags.length > 0 && tags.map((tag)=>{
      const tagHash = stringHash(tag);
      const url = tag === author? ("/author/" + tagHash) : ("/tag/" + tagHash);
      return (<div key={tag} className="one-book-foot-author" >
                <Link to={url}  key={tag}>{tag}</Link>
              </div>);
    })

    return (<div className="one-book-tags">
            {tagDivs}
          </div>);
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
        return (<CenterSpinner />);
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
        <div className="one-book-title"> {this.renderPath()} {_.getFn(this.state.path)} </div>
        {this.renderPagination()}
        {this.renderFileSizeAndTime()}
        {this.renderTags()}
        {this.renderToolbar()}
        {this.renderToggleFullScreenButton()} 
      </div>
    );
  }
}

OneBook.propTypes = {
};
