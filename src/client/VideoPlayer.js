import React, { Component } from 'react';
import _ from 'underscore';
import './style/VideoPlayer.scss';
import FileNameDiv from './subcomponent/FileNameDiv';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, filesizeUitl } = clientUtil;
import { Link } from 'react-router-dom';
import Sender from './Sender';
const queryString = require('query-string');
const Cookie = require("js-cookie");
import DPlayer from "react-dplayer";
import HistorySection from './subcomponent/HistorySection';


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
    // let tags = namePicker.pick(dirName) || [];
    let tags = [];
    tags = _.uniq(tags);

    if (tags.length > 0) {
      const tagDoms = tags.map(tag => {
        const url = clientUtil.getSearhLink(tag);
        return (<Link target="_blank" className="video-tag" to={url} key={tag}>{tag}</Link>)
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
        <Link target="_blank" to={toUrl}>{parentPath} </Link>
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

 adjustHW(){
    const videoRef = this.dp.video;
    const hh = videoRef.videoHeight; // returns the intrinsic height of the video
    const ww = videoRef.videoWidth;
    var doc_width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    var doc_height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    const scale = clientUtil.isMobile()? 0.9: 0.7;
    if (hh > ww) {
      videoRef.style.height = doc_height * scale + "px";
    }else{
      videoRef.style.width = doc_width * scale + "px";
    }
  }

  onLoadedmetadata() {
    this.adjustHW();

    const filePath = this.getTextFromQuery();
    const previous = parseFloat(Cookie.get(filePath));
    if(previous > 1 ){
      this.dp.seek(previous)
    }

    const that = this;
    this.dp.on('fullscreen', function () {
      console.log('player fullscreen');
      const videoRef = that.dp.video;
      videoRef.style.height = "";
       videoRef.style.width = "";
    });

    this.dp.on('fullscreen_cancel', function () {
      console.log('player fullscreen cancel');
      that.adjustHW();
    });
  }

  render() {
    const filePath = this.getTextFromQuery();
    const url = clientUtil.getFileUrl(this.getTextFromQuery());
    const fileName = getBaseName(filePath);
    document.title = fileName;
    const { hasError, stat, mecab_tokens } = this.state;
    //use bootstrap classname util 
    const videoTitle = filePath && (<div className="video-title">
      <center> <FileNameDiv mecab_tokens={mecab_tokens} filename={fileName} className="inline-display" /></center>
      {this.renderPath()}
    </div>);

    const fileSize = stat && filesizeUitl(stat.size);
    const mTime = stat && clientUtil.dateFormat_ymd(new Date(stat.mtimeMs));

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
      <div className="video-history-section">
        <HistorySection filePath={filePath} />
      </div>
    </div>
    );
  }
}

