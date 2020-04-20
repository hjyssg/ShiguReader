import React, { Component } from 'react';
import _ from 'underscore';
import './style/VideoPlayer.scss';
const filesizeUitl = require('filesize');
import ClickAndCopyText from './subcomponent/ClickAndCopyText';


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
    const fn = window.localStorage && window.localStorage.getItem(this.getHash());
    //temp
    const url = "http://localhost:8080/api/video/"+this.getHash();
    return (<div className="video-player-page">
              <div className="video-player-container">
                <video id="videoPlayer" controls> 
                  <source src={url} type="video/mp4" />
                </video>
              </div>
             <div className="video-title">  <ClickAndCopyText  text={fn} /> </div>
            </div>
            );
  } 
}

VideoPlayer.propTypes = {
};
