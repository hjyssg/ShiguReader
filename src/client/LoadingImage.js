import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Sender from './Sender';
const Constant = require("@common/constant");
const classNames = require('classnames');
import "./style/LoadingImage.scss"
const clientUtil = require("./clientUtil");
const { encodeFileUrl } = clientUtil;

export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      failed: 0,
      url: props.url
    };
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
    if (this.props.asSimpleImage) {
      return false;
    }
    if (!this.state.url) {
      return true
    } else {
      if (this.state.url === "NOT_THUMBNAIL_AVAILABLE") {
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
    const api = (this.isAuthorTagMode()) ? "/api/tagFirstImagePath" : '/api/firstImage';
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
        this.setState({ failed: this.state.failed + 1 });
      } else {
        const url = res.json.url
        this.props.onReceiveUrl && this.props.onReceiveUrl(url);
        this.setState({ url });
      }
    });
  }

  onError() {
    if (!this.tryEnoughRequest()) {
      this.setState({
        url: null,
        failed: this.state.failed + 1
      }, () => {
        this.requestThumbnail()
      });
    }
  }

  tryEnoughRequest() {
    return this.state.failed > 2;
  }

  isThumbnailAvaible() {
    return this.state.url && this.state.url !== "NOT_THUMBNAIL_AVAILABLE";
  }

  render() {
    let content;
    const { className, fileName, url, bottomOffet, topOffet, title, 
           isThumbnail, onReceiveUrl, asSimpleImage, style, musicNum, ...others } = this.props;

    const empty_icon_cn = musicNum > 0 ? " fas fa-music" : " fas fa-file-archive";

    let cn = classNames("loading-image", className, {
      "empty-block": !this.isThumbnailAvaible()
    });

    if (!this.isThumbnailAvaible()) {
      cn += empty_icon_cn;
    }


    const _url = asSimpleImage ? url : encodeFileUrl(this.state.url);

    if (this.isThumbnailAvaible()) {
      content = (<img style={style} key={fileName} ref={e => { this.dom = e && e.node }}
        className={className} src={_url} title={title || fileName}
        onError={this.onError.bind(this)}
        {...others} />);
    } else {
      content = (<div key={fileName} className={cn} title={title || fileName} {...others} />);
    }

    return content;
  }
}

LoadingImage.propTypes = {
  fileName: PropTypes.string,
  className: PropTypes.string,
  mode: PropTypes.string,
  url: PropTypes.string,   //predefined url, not request from this component,
  bottomOffet: PropTypes.number,
  topOffet: PropTypes.number,
  onChange: PropTypes.func
};
