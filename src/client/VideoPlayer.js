import React, { Component } from 'react';
import _ from 'underscore';
import './style/VideoPlayer.scss';
import ClickAndCopyText from './subcomponent/ClickAndCopyText';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
const util = require("../util");
const clientUtil = require("./clientUtil");
const { getDir, getFn, getPathFromLocalStorage } = clientUtil;

export default class VideoPlayer extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  getHash(){
    return this.props.match.params.number;
  }

  render() {
    const fn = getPathFromLocalStorage(this.getHash());
    const url = "http://localhost:8080/api/video/"+this.getHash();
    document.title = getFn(fn);

    return (<div className="video-player-page">
              <div className="video-player-container">
                <video id="videoPlayer" controls> 
                  <source src={url} type="video/mp4" />
                </video>
              </div>
             <div className="video-title">  <ClickAndCopyText  text={fn} /> </div>
            <FileChangeToolbar showAllButtons className="video-toolbar" file={fn} popPosition={"top-center"}/>
            </div>
            );
  } 
}

VideoPlayer.propTypes = {
};
