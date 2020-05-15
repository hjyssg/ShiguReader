import React, { Component } from 'react';
import _ from 'underscore';
const filesizeUitl = require('filesize');
import './style/VideoPlayer.scss';
import ClickAndCopyText from './subcomponent/ClickAndCopyText';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPathFromLocalStorage } = clientUtil;
const namePicker = require("../human-name-picker");
import { Link } from 'react-router-dom';
const nameParser = require('../name-parser');
import Sender from './Sender';
const dateFormat = require('dateformat');

export default class VideoPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount(){
    const filePath = getPathFromLocalStorage(this.getHash());
    if(filePath){
      Sender.post("/api/singleFileInfo", {filePath}, res => {
        if(!res.failed){
          const {stat} = res;
          this.setState({stat})
        }else{
          this.res = res;
          this.onError();
        } 
      });
    }
  }

  getHash(){
    return this.props.match.params.number;
  }

  onError(e){
    // console.log();
    this.setState({
      hasError: true
    })
  }

  renderDownloadLink(){
    return (<a href={"/api/download/"+this.getHash()}><i className="fa fa-fw fa-download"></i></a>);
  }
  
  renderTag(){
    const filePath = getPathFromLocalStorage(this.getHash());
    const fn = getBaseName(filePath);
    const dirName = getBaseName(getDir(filePath));
    const tags1 = namePicker.parse(fn) || [];
    const tags2 = namePicker.parse(dirName) || []; 
    let tags = tags1.concat(tags2);

    const result = nameParser.parse(fn);

    if(result){
      [result.author].concat(result.tags).forEach(value => {
        if(value){
          tags = tags.concat(value);
        }
      })
    }

    tags = _.uniq(tags);
    
    if(tags){
      const tagDoms = tags.map(tag => {
          const url =  clientUtil.getSearhLink(tag);
          return (<Link className="video-tag"  target="_blank" to={url}  key={tag}>{tag}</Link>)
      });

      return (<div className="video-tag-row">  {tagDoms} </div>);
    }
  }

  renderPath() {
    const filePath = getPathFromLocalStorage(this.getHash());
    const parentPath = getDir(filePath);
    const toUrl = clientUtil.getExplorerLink(parentPath);
    
    return (
      <div className="one-book-path">
        <Link to={toUrl}>{parentPath} </Link>
      </div>);
  }

  render() {
    const filePath = getPathFromLocalStorage(this.getHash());
    const url = "/api/download/" + this.getHash();
    const fileName = getBaseName(filePath);
    document.title = fileName;
    const {hasError, stat} = this.state;
    //use bootstrap classname util 
    const videoTitle = filePath && (<div className="video-title"> 
                          <center> <ClickAndCopyText text={fileName} className="inline-display" />  {this.renderDownloadLink()} </center>
                          {this.renderPath()}
                         </div>);


    if(hasError || !filePath){
      const infoStr=  (!filePath || (this.res && this.res.res.status === 404) )? "Video Not Found": "Uneble to Play Video";
      return (<div className="container"> 
          <div className="alert alert-warning col-6" role="alert">{infoStr}</div>
          {videoTitle}
        </div>
      )
    }
    
    const fileSize = stat && filesizeUitl(stat.size, {base: 2});
    const mTime = stat &&  dateFormat(stat.mTime, "isoDate");

    return (<div className="video-player-page">
              <div className="video-player-container">
                <video id="videoPlayer" controls> 
                  <source src={url} type="video/mp4" onError={this.onError.bind(this)} />
                </video>
              </div>
              {videoTitle}
              <div className="video-file-info-row">
                <span>{fileSize}</span>
                <span style={{marginLeft: "10px"}}> {mTime} </span>
              </div>
              <FileChangeToolbar showAllButtons className="video-toolbar" file={filePath} popPosition={"top-center"}/>
              {this.renderTag()}
            </div>
            );
  } 
}

VideoPlayer.propTypes = {
};
