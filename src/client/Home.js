// @flow

import React, { Component } from 'react';
import LoadingImage from './LoadingImage';
import Alert from 'react-bootstrap/lib/Alert';
import folderIcon from './images/folder.png';
import _ from "underscore";

const path = require('path');

export default class Home extends Component {
  constructor(prop){
    super(prop);
    this.state = { hasError: false, dirs: [], files:[], loadedHome:false};
  }

  componentDidCatch(error, info) {
    // Display fallback UI
    this.setState({ hasError: true });
  }

  componentDidMount() {
    if(this.state.loadedHome){
      return;
    }

    fetch('/api/home')
      .then(_.resHandle)
      .then(res => {
          this.setState({ 
            loadedHome: true,
            ...res
          });
      });
  }

  onDirClick(value){
    fetch('/api/lsDir',{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({dir: value})
    })
    .then(_.resHandle)
    .then(res => {
        this.setState({...res});
    });
  }

  onFileCilck(value){
    if(_.isCompress(value) && this.props.modeChange){
      this.props.modeChange(value);
    }
  }

  getTableRow(image, item, isFolder){
    // var fn = path.basename(item, path.extname(item));
    let func = isFolder? this.onDirClick: this.onFileCilck;
    func = func.bind(this, item);
    return (
      <li type="button" className="list-group-item btn btn-primary home-row" key={item} 
                        onClick={func}>
        {image}
        <span className="row-file-name">{item}</span>
      </li>);
  }

  renderFileList(){
    const {dirs, files, res, failed} = this.state;
    if(failed || (res && res.status !== 200)){
      return(
        <div className="alert alert-danger" role="alert">
          The server is down. Please check.
        </div>)
    } else if(_.isEmpty(dirs) && _.isEmpty(files)){
      return(
      <div className="alert alert-info" role="alert">
        Loading...
      </div>)
    }  

    const dirItems = dirs.map((item, index) => {
      return this.getTableRow(<img className="row-thumbnail-image" src={folderIcon}/>, item, "isDir");
    });

    //!!todo if the file is already an image file

    const fileItems = files.map((item, index) => {
      return  this.getTableRow(<LoadingImage className="row-thumbnail-image" fileName={item}/>, item);
    });

    return (
      <ul className="list-group">
        {dirItems}
        {fileItems}
      </ul>
    );
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

Home.propTypes = {

};