import React, { Component } from 'react';
import _ from 'underscore';
import './style/VideoPlayer.scss';
import FileNameDiv from './subcomponent/FileNameDiv';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, filesizeUitl } = clientUtil;
const namePicker = require("../human-name-picker");
import { Link } from 'react-router-dom';
import Sender from './Sender';
const dateFormat = require('dateformat');
const queryString = require('query-string');
const Cookie = require("js-cookie");
import DPlayer from "react-dplayer";

export default class VideoPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount() {
    const filePath = this.getTextFromQuery();
    if (filePath) {
      Sender.post("/api/singleFileInfo", { filePath }, res => {
        if (!res.isFailed()) {
          const { stat, mecab_tokens } = res.json;
          this.setState({ stat, mecab_tokens })
        } else {
          this.res = res;
          this.onError();
        }
      });
    }
  }

  getTextFromQuery(props) {
    //may allow tag author in future
    const _props = props || this.props;
    return queryString.parse(_props.location.search)["p"] || "";
  }

  onError(e) {
    // console.log();
    this.setState({
      hasError: true
    })
  }

  renderTag() {
    const filePath = this.getTextFromQuery();
    const dirName = getBaseName(getDir(filePath));
    let tags = namePicker.pick(dirName) || [];
    tags = _.uniq(tags);

    if (tags) {
      const tagDoms = tags.map(tag => {
        const url = clientUtil.getSearhLink(tag);
        return (<Link className="video-tag" target="_blank" to={url} key={tag}>{tag}</Link>)
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

  onLoad(dp) {
    this.dp = dp;
  }

  onTimeupdate(){
    const filePath = this.getTextFromQuery();
    try{
      Cookie.set(filePath, this.dp.video.currentTime);
    }catch(e){
      console.error(e);
    }
  }

  onLoadedmetadata() {
    const videoRef = this.dp.video;
    const hh = videoRef.videoHeight; // returns the intrinsic height of the video
    const ww = videoRef.videoWidth;
    if (hh > ww) {
      videoRef.className = "vertical-video"
    }else{
      videoRef.className = "horizontal-video"
    }

    const filePath = this.getTextFromQuery();
    const previous = parseFloat(Cookie.get(filePath));
    if(previous > 1 ){
      this.dp.seek(previous)
    }
  }

  render() {
    const filePath = this.getTextFromQuery();
    const url = clientUtil.getDownloadLink(this.getTextFromQuery());
    const fileName = getBaseName(filePath);
    document.title = fileName;
    const { hasError, stat, mecab_tokens } = this.state;
    //use bootstrap classname util 
    const videoTitle = filePath && (<div className="video-title">
      <center> <FileNameDiv mecab_tokens={mecab_tokens} filename={fileName} className="inline-display" /></center>
      {this.renderPath()}
    </div>);

    const fileSize = stat && filesizeUitl(stat.size);
    const mTime = stat && dateFormat(stat.mtime, "isoDate");

    const videoFileInfo = (stat && <div className="video-file-info-row">
      <span>{fileSize}</span>
      <span style={{ marginLeft: "10px" }}> {mTime} </span>
    </div>);

    let content;
    if (hasError || !filePath) {
      const infoStr = (!filePath || (this.res && this.res.status === 404)) ? "Video Not Found" : "Unable to Play Video";
      content = (<div className="flex-center-display-container">  <div className="alert alert-warning col-6" role="alert">{infoStr}</div> </div>);
    } else {
      content = (
        <div className="video-player-container">
          <DPlayer
                options={{
                    lang: navigator.language.toLowerCase(),
                    video:{ url: url},
                    playbackSpeed:	[0.5, 0.75, 1, 1.125, 1.25, 1.5, 2]
                }}
                onLoadedmetadata={this.onLoadedmetadata.bind(this)}
                onLoad={this.onLoad.bind(this)}
                onError={this.onError.bind(this)}
                onTimeupdate={this.onTimeupdate.bind(this)}
                />
        </div>
      );
    }

    return (<div className="video-player-page">
      {content}
      {videoTitle}
      {videoFileInfo}
      <FileChangeToolbar className="video-toolbar" file={filePath} popPosition={"top-center"} />
      {this.renderTag()}
    </div>
    );
  }
}

VideoPlayer.propTypes = {
};
