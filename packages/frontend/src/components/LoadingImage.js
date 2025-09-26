import React, { Component } from 'react';
import Sender from '@services/Sender';
const classNames = require('classnames');
import "@styles/LoadingImage.scss";
const clientUtil = require("@utils/clientUtil");
const util = require("@common/util");
const _ = require("underscore");
const VisibilitySensor = require('react-visibility-sensor').default;

// 同时初始的url不好用，才会去api request
// 三个场景： 普通zip，folder，tag
export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      url: props.url,
      isVisible: false
    };
    console.assert(["tag", "author", "folder", "zip"].includes(props.mode))
  }

  componentDidUpdate(prevProps) {
    if (this.props.url && prevProps.url !== this.props.url) {
      this.setState({
        url: this.props.url
      });
    }
  }

  onChange(isVisible) {
    // only use to turn on
    if (!isVisible) {
      return;
    }

    this.setState({
      isVisible
    })

    if (this.shouldAskUrl()) {
      this.requestThumbnail()
    }
  }

  shouldAskUrl() {
    if (this.state.url === "NO_THUMBNAIL_AVAILABLE" || this.props.url === "NO_THUMBNAIL_AVAILABLE") {
      return false;
    } else {
      return !this.props.url;
    }
  }

  componentDidMount() {
    // if (this.shouldAskUrl()) {
    //   this.requestThumbnail()
    // }
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  isAuthorTagMode() {
    const { mode } = this.props;
    return mode === "author" || mode === "tag";
  }

  async requestThumbnail() {
    const { mode, fileName } = this.props;
    let res;
    if (this.isAuthorTagMode()) {
      const body = {};
      body[mode] = fileName;
      res = await Sender.postWithPromise("/api/getTagThumbnail", body);
    } else if (mode === "folder") {
      const query = encodeURIComponent(fileName);
      res = await Sender.getWithPromise(`/api/folderThumbnailFromDisk?filePath=${query}`);
    } else {
      res = await Sender.postWithPromise('/api/getZipThumbnail', { filePath: fileName });
    }

    if (!this.isUnmounted) {
      if (res.isFailed()) {
        this.setState({ url: "NO_THUMBNAIL_AVAILABLE" })
      } else {
        const url = clientUtil.getFileUrl(res.json.url);
        this.setState({ url });
      }
    }
  }



  getImageUrl() {
    if(this.state.url && this.state.url !== "NO_THUMBNAIL_AVAILABLE"){
      return this.state.url;
    }
  }

  render() {
    const { className, style, fileName, url, title,
      mode, musicNum, ...others } = this.props;

    const _url = this.getImageUrl();


    let cn = classNames("loading-image", className, {
      "empty-block": !_url
    });



    if (!_url) {
      let temp = "";
      if (musicNum > 0) {
        temp = "fas fa-music"
      } else if (mode === "zip") {
        temp = "fas fa-file-archive"
      } else if (mode == "folder") {
        temp = "far fa-folder"
      }else if (mode == "tag") {
        temp = "fas fa-tags"
      }else if (mode == "author") {
        temp = "fas fa-pen"
      }
      cn += " " +  temp;
    }


    let content;
    if (_url) {
      content = (<img style={style} key={fileName} ref={e => { this.dom = e && e.node }}
        className={className} src={_url} title={title || fileName}
        loading="lazy"
        {...others} />);
    } else {
      content = (<div key={fileName} className={cn} title={title || fileName} {...others} />);
    }

    return (
      <VisibilitySensor offset={{ bottom: -200 }} partialVisibility={true} onChange={this.onChange.bind(this)}>
          {content}
      </VisibilitySensor>
    )
  }
}
