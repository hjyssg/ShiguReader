import React, { Component } from 'react';
import _ from 'underscore';
import './style/VideoPlayer.scss';
import ClickAndCopyText from './subcomponent/ClickAndCopyText';
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPathFromLocalStorage, cleanSearchStr } = clientUtil;
const namePicker = require("../human-name-picker");
import { Link } from 'react-router-dom';
import { array_unique } from '../util';
const nameParser = require('../name-parser');

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

    tags = array_unique(tags);
    
    if(tags){
      const tagDoms = tags.map(tag => {
          const url = "/search/" + cleanSearchStr(tag);
          return (<Link className="video-tag"  target="_blank" to={url}  key={tag}>{tag}</Link>)
      });

      return (<div className="video-tag-row">  {tagDoms} </div>);
    }
  }

  render() {
    const fn = getPathFromLocalStorage(this.getHash());
    const url = "/api/video/" + this.getHash();
    document.title = getBaseName(fn);
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
                <ClickAndCopyText text={fn} />  {this.renderDownloadLink()}
              </div>
              <FileChangeToolbar showAllButtons className="video-toolbar" file={fn} popPosition={"top-center"}/>
              {this.renderTag()}
            </div>
            );
  } 
}

VideoPlayer.propTypes = {
};
