import React, { Component } from 'react';
import _ from 'underscore';
const filesizeUitl = require('filesize');
import './style/VideoPlayer.scss';
import ClickAndCopyText from './subcomponent/ClickAndCopyText';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
const clientUtil = require("./clientUtil");
const { getDir, getBaseName } = clientUtil;
const namePicker = require("../human-name-picker");
import { Link } from 'react-router-dom';
const nameParser = require('@name-parser');
import Sender from './Sender';
const dateFormat = require('dateformat');
const queryString = require('query-string');


export default class VideoPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount(){
    const filePath = this.getTextFromQuery();
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

  getTextFromQuery(props){
      //may allow tag author in future
      const _props = props || this.props;
      return queryString.parse(_props.location.search)["p"] ||  "";
  }

  onError(e){
    // console.log();
    this.setState({
      hasError: true
    })
  }
  
  renderTag(){
    const filePath = this.getTextFromQuery();
    const fn = getBaseName(filePath);
    const dirName = getBaseName(getDir(filePath));
    const tags1 = namePicker.pick(fn);
    const tags2 = namePicker.pick(dirName); 
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
    const filePath = this.getTextFromQuery();
    const parentPath = getDir(filePath);
    const toUrl = clientUtil.getExplorerLink(parentPath);
    
    return (
      <div className="one-book-path">
        <Link to={toUrl}>{parentPath} </Link>
      </div>);
  }

  render() {
    const filePath = this.getTextFromQuery();
    const url = clientUtil.getDownloadLink(this.getTextFromQuery());
    const fileName = getBaseName(filePath);
    document.title = fileName;
    const {hasError, stat} = this.state;
    //use bootstrap classname util 
    const videoTitle = filePath && (<div className="video-title"> 
                          <center> <ClickAndCopyText text={fileName} className="inline-display" /></center>
                          {this.renderPath()}
                         </div>);

  const fileSize = stat && filesizeUitl(stat.size, {base: 2});
  const mTime = stat &&  dateFormat(stat.mTime, "isoDate");

  const videoFileInfo = (stat && <div className="video-file-info-row">
                          <span>{fileSize}</span>
                          <span style={{marginLeft: "10px"}}> {mTime} </span>
                        </div>);

    let content;
    if(hasError || !filePath){
      const infoStr=  (!filePath || (this.res && this.res.res.status === 404) )? "Video Not Found": "Unable to Play Video";
      content = (<div className="flex-center-display-container">  <div className="alert alert-warning col-6" role="alert">{infoStr}</div> </div>);
    }else{
      content = (
        <div className="video-player-container">
          <video id="videoPlayer" controls> 
            <source src={url} type="video/mp4" onError={this.onError.bind(this)} />
          </video>
        </div>
      );
    }

    return (<div className="video-player-page">
              {content}
              {videoTitle}
              {videoFileInfo}
              <FileChangeToolbar showAllButtons className="video-toolbar" file={filePath} popPosition={"top-center"}/>
              {this.renderTag()}
            </div>
            );
  } 
}

VideoPlayer.propTypes = {
};
