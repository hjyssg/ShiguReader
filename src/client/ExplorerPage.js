// @flow
import React, { Component } from 'react';
import _ from "underscore";
import PropTypes from 'prop-types';
import LoadingImage from './LoadingImage';
import folderIcon from './images/folder.png';

export default class ExplorerPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = {
          hasError: false,
          dirs: (this.props.dirs || []),
          files: [],
          currentPath: ""
        };
    }

    componentDidUpdate() {
      if (this.props.pathForHome) {
          this.displayPath(this.props.pathForHome);
      }
    }

    getCurrentPath() {
      return this.state.currentPath;
    }

    onFileCilck(value) {
        if (_.isCompress(value) && this.props.modeChange) {
            this.props.modeChange(value);
        }
    }

    getTableRow(image, item, isFolder) {
    // var fn = path.basename(item, path.extname(item));
        let func = isFolder ? this.displayPath : this.onFileCilck;
        func = func.bind(this, item);
        return (
            <li
                type="button"
                className="list-group-item btn btn-primary home-row"
                key={item}
                onClick={func}
            >
                {image}
                <span className="row-file-name">{item}</span>
            </li>
        );
    }

    displayPath(value) {
      fetch('/api/lsDir', {
          method: 'POST',
          headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dir: value })
      })
      .then(_.resHandle)
      .then(res => {
          if (!res.failed) {
              this.setState({
                  currentPath: value,
                  ...res
              });
          }
      });
    }

    renderFileList() {
        const {
            dirs, files, res, failed
        } = this.state;

        if (failed || (res && res.status !== 200)) {
            return (
                <div className="alert alert-danger" role="alert">The server is down. Please check.</div>
            );
        } else if (_.isEmpty(dirs) && _.isEmpty(files)) {
            return (
                <div className="alert alert-info" role="alert">Loading...</div>
            );
        }

        const dirItems = dirs.map((item) => this.getTableRow(<img className="row-thumbnail-image" src={folderIcon} alt="folder-thumbnail"/>, item, "isDir"));
        //! !todo if the file is already an image file
        const fileItems = files.map((item) => this.getTableRow(<LoadingImage className="row-thumbnail-image row-thumbnail-file-image" fileName={item} />, item));
        return (
            <ul className="list-group">
                {dirItems}
                {fileItems}
            </ul>
        );
    }

    componentDidCatch(error) {
        // Display fallback UI
        console.error(error);
        this.setState({ hasError: true });
    }

    render() {
        const { hasError } = this.state;
        if (hasError) {
            // You can render any custom fallback UI
            return <h1>Something went wrong.</h1>;
        }
        return (
            <div className="home-container">
                {this.renderFileList()}
            </div>
        );
    }
}

ExplorerPage.propTypes = {
    pathForHome: PropTypes.string,
    dirs: PropTypes.array,
    modeChange: PropTypes.func
};
