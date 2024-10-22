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


    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === "+" || key === "=") {
        this.changeVideoSize(1.1)
      } else if (key === "-") {
        this.changeVideoSize(0.9)
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
    const hh = videoRef.videoHeight; // 返回视频的内在高度
    const ww = videoRef.videoWidth; // 返回视频的内在宽度
    const docWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const docHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    const aspectRatio = ww / hh; // 计算视频的宽高比

    // 计算基于文档宽度的目标视频宽度
    let scale;
    if(ww>hh){
      scale = clientUtil.isMobile() ? 0.9 : 0.8;
    }else {
      scale = clientUtil.isMobile() ? 0.95 : 0.95;
    }
    let targetWidth = docWidth * scale;

    // 计算基于目标宽度的视频高度
    let targetHeight = targetWidth / aspectRatio;

    // 如果计算出的高度超过了文档的高度，则重新调整宽度和高度
    if (targetHeight > docHeight * scale) {
        targetHeight = docHeight * scale;
        targetWidth = targetHeight * aspectRatio;
    }

    // 应用样式调整
    videoRef.style.width = targetWidth + "px";
    // videoRef.style.height = targetHeight + "px";
  }

  changeVideoSize(ratio) {
    const videoRef = this.dp.video;
    if (!videoRef) {
        console.error('No video element found!');
        return;
    }

    const currentWidth = videoRef.offsetWidth;
    const newWidth = currentWidth * ratio;
    videoRef.style.width = `${newWidth}px`;
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
                    playbackSpeed:	[0.5, 0.75, 1, 1.125, 1.25, 1.5, 2],
                    contextmenu: [
                      {
                          text: 'Bigger +',
                          click: (player) => {
                            // console.log(player);
                            this.changeVideoSize(1.1) 
                        },
                      },
                      {
                          text: 'Smaller -',
                          click: (player) => {
                            this.changeVideoSize(0.9) 
                          },
                      },
                      {
                        text: '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯',
                    },
                  ]
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
      <div className='vertical-gap-container'>
          {videoTitle}
          {videoFileInfo}
          <FileChangeToolbar className="video-toolbar" file={filePath} popPosition={"top-center"}  returnButtonOnly={true}/>
          {this.renderTag()}
          <HistorySection filePath={filePath} />
      </div>
    </div>
    );
  }
}

