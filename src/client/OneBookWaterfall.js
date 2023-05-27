import React, { Component } from 'react';
import _ from 'underscore';
const nameParser = require('@name-parser');
const classNames = require('classnames');
import ReactDOM from 'react-dom';

import { Link } from 'react-router-dom';
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import FileNameDiv from './subcomponent/FileNameDiv';

const util = require("@common/util");
const queryString = require('query-string');
import screenfull from 'screenfull';

const clientUtil = require("./clientUtil");
const { getDir, getBaseName, isMobile, getFileUrl, sortFileNames } = clientUtil;
const VisibilitySensor = require('react-visibility-sensor').default;

class SmartImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isVisible: props.visible || false
    };
  }

  onChange(isVisible) {
    if (this.state.isVisible && !isVisible) {
      return;
    }

    this.setState({
      isVisible
    })
  }

  render() {
    const { url, index, style } = this.props;
    const { isVisible } = this.state;

    let content = (<img className="one-book-waterfall-image"
        src={isVisible? url : ""}
        title={index}
        style={style} 
        loading="lazy"
        />)

    return (
      <VisibilitySensor offset={{ bottom: -150 }} partialVisibility={true} onChange={this.onChange.bind(this)}>
            {content}
      </VisibilitySensor>
    )
  }
}

//maybe combine with renderOneBookOverview into one file


export default class OneBookWaterfall extends Component {
  constructor(props) {
    super(props);
    this.state = {
      imageFiles: [],
      musicFiles: [],
    };
  }

  getTextFromQuery(props) {
    const _props = props || this.props;
    return queryString.parse(_props.location.search)["p"] || "";
  }

  askRerender(){
    this.setState({
        rerenderTick: !this.state.rerenderTick
    })
}

  componentDidMount() {
    this.sendExtract();

    if (!isMobile()) {
      screenfull.onchange(() => {
        this.askRerender();
      });
    }
  }

  isImgFolder() {
    return !util.isCompress(this.getTextFromQuery())
  }

  async sendExtract() {
    const fp = this.getTextFromQuery();
    const api = this.isImgFolder() ? "/api/listImageFolderContent" : "/api/extract";
    const res = await Sender.postWithPromise(api, { filePath: fp, startIndex: 0 });
    this.handleRes(res);
  }

  handleRes(res) {
    this.res = res;
    if (!res.isFailed()) {
      let { zipInfo, path, stat, imageFiles, musicFiles } = res.json;
      imageFiles = imageFiles || [];
      musicFiles = musicFiles || [];

      //imageFiles name can be 001.jpg, 002.jpg, 011.jpg, 012.jpg
      //or 1.jpg, 2.jpg 3.jpg 1.jpg
      //todo: the sort is wrong for imgFolder
      sortFileNames(imageFiles);
      sortFileNames(musicFiles);

      this.setState({ imageFiles, musicFiles, path, fileStat: stat, zipInfo });
    } else {
      this.askRerender();
    }
  }

  isFailedLoading() {
    return this.res && this.res.isFailed();
  }

  onError() {
    //todo
    //maybe display a center spin
  }

  getMaxHeight() {
    if (isMobile()) {
      return window.screen.height - 10;
    }

    let maxHeight = isNaN(window.innerHeight) ? window.clientHeight : window.innerHeight;
    return maxHeight - 10;
  }

  renderImage() {
    const { imageFiles } = this.state;
    if (!this.hasImage()) {
      return;
    }

    const maxHeight = this.getMaxHeight();

    let images = imageFiles.map((file, index) => {
      return (<div key={file} className="one-book-waterfall-div">
        <SmartImage 
          visible={index < 3}
          url={getFileUrl(file)}
          index={index}
          style={{ maxHeight: maxHeight }}
        />
      </div>);
    });
    return (<div className="mobile-one-book-container">
      {images}
    </div>);
  }

  renderPath() {
    if (!this.state.path) {
      return;
    }

    const parentPath = getDir(this.state.path);
    const toUrl = clientUtil.getExplorerLink(parentPath);

    return (
      <div className="one-book-path">
        <Link to={toUrl}>{parentPath} </Link>
      </div>);
  }

  hasImage() {
    return this.state.imageFiles.length > 0;
  }

  render() {
    if (this.isFailedLoading()) {
      const fp = this.getTextFromQuery();
      return <ErrorPage res={this.res} filePath={fp} />;
    }

    const { imageFiles, musicFiles } = this.state;
    const bookTitle = (<div className="one-book-title" >
      <FileNameDiv filename={getBaseName(this.state.path)} />
      {this.renderPath()}
    </div>);

    if (_.isEmpty(imageFiles) && _.isEmpty(musicFiles)) {
      if (this.res && !this.res.isFailed()) {
        return (<h3>
          <center style={{ paddingTop: "200px" }}>
            <div className="alert alert-warning col-6" role="alert" > No image or music file </div>
            {bookTitle}
            {this.renderTags()}
            {this.renderToolbar()}
          </center>
        </h3>);
      } else {
        return (<CenterSpinner text={this.getTextFromQuery()} splitFilePath />);
      }
    }

    if (this.state.path) {
      document.title = getBaseName(this.state.path);
    }

    const wraperCn = classNames("one-book-wrapper", {
      "full-screen": screenfull.isFullscreen,
    });

    const content = (<div className={wraperCn} ref={wrapper => this.wrapperRef = wrapper}>
      {this.renderImage()}
    </div>);


    return (
      <div className="one-book-container">
        {bookTitle}
        {content}
      </div>
    );
  }
}

OneBookWaterfall.propTypes = {
};
