import React, { Component } from 'react';
import Sender from './Sender';
const classNames = require('classnames');
import "./style/LoadingImage.scss"
const clientUtil = require("./clientUtil");
const util = require("@common/util");

// 需要是isThumbnail && onlyUseURL && 同时初始的url不好用，才会去api request
export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fail_time: 0,
      url: props.url
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.url && prevProps.url !== this.props.url && !this.isUrlAvaible()) {
      this.setState({
        url: this.props.url
      });
    }
  }

  componentDidMount() {
    if (this.props.isThumbnail) {
      setTimeout(() => {
        this.onChange(true)
      }, 0);
    }
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  shouldAskUrl() {
    if(this.props.onlyUseURL){
      return false;
    }else if (!this.state.url) {
      return true;
    } else {
      if (this.state.url === "NO_THUMBNAIL_AVAILABLE") {
        return this.isAuthorTagMode();
      } else {
        return false;
      }
    }
  }

  onChange() {
    if (this.shouldAskUrl() & !this.loading) {
      this.requestThumbnail()
    }
  }

  isAuthorTagMode() {
    const { mode } = this.props;
    return mode === "author" || mode === "tag";
  }

  requestThumbnail() {
    const { mode, fileName } = this.props;
    const api = (this.isAuthorTagMode()) ? "/api/getTagThumbnail" : '/api/getZipThumbnail';
    const body = {};

    if (this.isAuthorTagMode()) {
      body[mode] = fileName;
    } else {
      body["filePath"] = fileName;
    }

    this.loading = true;
    Sender.post(api, body, res => {
      if (this.isUnmounted) {
        return;
      }
      if (res.isFailed()) {
        this.setState({ fail_time: this.state.fail_time + 1 });
      } else {
        const url = clientUtil.getFileUrl(res.json.url);
        this.props.onReceiveUrl && this.props.onReceiveUrl(url);
        this.setState({ url });
      }
    });
  }

  onError() {
    if (!this.tryEnoughRequest()) {
      this.setState({
        url: null,
        fail_time: this.state.fail_time + 1
      }, () => {
        this.requestThumbnail()
      });
    }
  }

  tryEnoughRequest() {
    return this.state.fail_time > 2;
  }

  isUrlAvaible() {
    return this.state.url && this.state.url !== "NO_THUMBNAIL_AVAILABLE";
  }

  render() {
    let content;
    const { className, style, fileName, url, title, 
             isThumbnail, onlyUseURL, mode, onReceiveUrl,
              musicNum, ...others } = this.props;

    let empty_icon_cn = "";
    if(musicNum > 0){
      empty_icon_cn = " fas fa-music"
    }else if(fileName && util.isCompress(fileName)){
      empty_icon_cn = " fas fa-file-archive"
    }else {
      empty_icon_cn = " far fa-folder"
    }

    let cn = classNames("loading-image", className, {
      "empty-block": !this.isUrlAvaible()
    });

    if (!this.isUrlAvaible() && empty_icon_cn) {
      cn += empty_icon_cn;
    }

    const _url = this.state.url;

    if (this.isUrlAvaible()) {
      content = (<img style={style} key={fileName} ref={e => { this.dom = e && e.node }}
        className={className} src={_url} title={title || fileName}
        onError={this.onError.bind(this)}
        loading="lazy" 
        {...others} />);
    } else {
      content = (<div key={fileName} className={cn} title={title || fileName} {...others} />);
    }

    return content;
  }
}
