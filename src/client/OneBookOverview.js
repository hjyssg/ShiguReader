import React, { Component } from 'react';
import _ from 'underscore';
const classNames = require('classnames');

import { Link } from 'react-router-dom';
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import FileNameDiv from './subcomponent/FileNameDiv';
// import ReactDOM from 'react-dom';

const VisibilitySensor = require('react-visibility-sensor').default;
const util = require("@common/util");
const queryString = require('query-string');
// const Constant = require("@common/constant");

const clientUtil = require("./clientUtil");
const { getDir, getBaseName, isMobile, getFileUrl, sortFileNames } = clientUtil;

class SmartImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isVisible: false
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
    const { url, index, fp } = this.props;
    const { isVisible } = this.state;

    let content;
    if (isVisible) {
      const tooltip = `page: ${index} \nfilename: ${getBaseName(fp)}`;
      content = (<img className="single-img-cell"
        src={url}
        title={tooltip} 
        loading="lazy"/>)
    } else {
      content = <div className="place-holder single-img-cell" title={index} />
    }

    const toUrl = clientUtil.getOneBookLink(fp, index);

    return (
      <VisibilitySensor offset={{ bottom: -1200 }} partialVisibility={true} onChange={this.onChange.bind(this)}>
        <div className="col-lg-3 col-md-4 col-6 a-with-padding" key={url}>
          <Link to={toUrl} target="_blank" className="obov-link">
            {content}
          </Link>
        </div>
      </VisibilitySensor>
    )
  }
}


export default class OneBookOverview extends Component {
  constructor(props) {
    super(props);
    this.state = {
      imageFiles: [],
      musicFiles: []
    };
  }


  getTextFromQuery(props) {
    const _props = props || this.props;
    return queryString.parse(_props.location.search)["p"] || "";
  }

  componentDidMount() {
    this.sendExtract();
  }

  isImgFolder() {
    return !util.isCompress(this.getTextFromQuery())
  }

  async sendExtract() {
    const fp = this.getTextFromQuery();
    const api = this.isImgFolder() ? "/api/listImageFolderContent" : "/api/extract";
    const res = await Sender.postWithPromise(api, { filePath: fp, startIndex: 0 })
    this.handleRes(res);
  }

  handleRes(res) {
    this.res = res;
    if (!res.isFailed()) {
      let { zipInfo, path, stat, imageFiles, musicFiles } = res.json;
      imageFiles = imageFiles || [];
      musicFiles = musicFiles || [];

      sortFileNames(imageFiles);
      sortFileNames(musicFiles);

      this.setState({ imageFiles, musicFiles, path, fileStat: stat, zipInfo });
    } else {
      this.forceUpdate();
    }
  }

  isFailedLoading() {
    return this.res && this.res.isFailed();
  }

  renderImageGrid() {
    const { imageFiles } = this.state;
    if (!this.hasImage()) {
      return;
    }

    // const fp = this.getTextFromQuery();
    const images = imageFiles
      .map((e, ii) => {
        let url = clientUtil.getDownloadLink(e);
        url += "&thumbnailMode=true"
        return (<SmartImage key={e+ii} url={url} index={ii} fp={e}></SmartImage>);
      })

    return images;
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

    const { imageFiles, index, musicFiles } = this.state;
    const bookTitle = (<div className="one-book-title" >
      <FileNameDiv filename={getBaseName(this.state.path)} />
      {this.renderPath()}
    </div>);

    if (_.isEmpty(imageFiles) && _.isEmpty(musicFiles)) {
      if (this.res && !this.refs.failed) {
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

    return (
      <div className="one-book-overview-container container">
        {bookTitle}
        <div className="row">
          {this.renderImageGrid()}
        </div>
      </div>
    );
  }
}

OneBookOverview.propTypes = {
};
