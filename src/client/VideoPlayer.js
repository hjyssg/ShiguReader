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

  onError(e){
    // console.log();
    this.setState({
      hasError: true
    })
  }

  render() {
    const fn = getPathFromLocalStorage(this.getHash());
    const url = "/api/video/" + this.getHash();
    document.title = getFn(fn);
    const {hasError} = this.state;
    //use bootstrap classname util 
    if(hasError || !fn){
      return (<div className="container"> 
          <div className="alert alert-warning col-6" role="alert"> Video Not Found </div>
        </div>
      )
    }

    return (<div className="video-player-page">
              <div className="video-player-container">
                <video id="videoPlayer" controls> 
                  <source src={url} type="video/mp4" onError={this.onError.bind(this)} />
                </video>
              </div>
              <div className="video-title"> 
                <ClickAndCopyText text={fn} /> 
              </div>
              <FileChangeToolbar showAllButtons className="video-toolbar" file={fn} popPosition={"top-center"}/>
            </div>
            );
  } 
}

VideoPlayer.propTypes = {
};
