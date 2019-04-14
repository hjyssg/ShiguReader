import React, { Component } from 'react';
import _ from 'underscore';
import './style/VideoPlayer.scss';
const spop  = require("./subcomponent/spop");
const util = require("../util");
const queryString = require('query-string');
const stringHash = util.stringHash;
const filesizeUitl = require('filesize');
import screenfull from 'screenfull';
const getUrl = util.getUrl;
const Constant = require("../constant");

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
    const fn =   window.localStorage && window.localStorage.getItem(this.getHash());
    return <div className="container video-player">
      todo
      </div>
  } 
}

VideoPlayer.propTypes = {
};
