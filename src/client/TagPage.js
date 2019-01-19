// @flow

import React, { Component } from 'react';
import LoadingImage from './LoadingImage';
import _ from "underscore";
const path = require('path');

export default class TagPage extends Component {
  constructor(prop){
    super(prop);
    this.state = { hasError: false, tags:[] };
  }

  componentDidCatch(error, info) {
    // Display fallback UI
    this.setState({ hasError: true });
  }

  componentDidMount() {
    if(this.state.loadedHome){
      return;
    }

    fetch('/api/tag')
      .then(_.resHandle)
      .then(res => {
          this.setState({ 
            loadedHome: true,
            ...res
          });
      });
  }

  // onDirClick(value){
  //   fetch('/api/lsDir',{
  //     method: 'POST',
  //     headers: {
  //       'Accept': 'application/json',
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({dir: value})
  //   })
  //   .then(_.resHandle)
  //   .then(res => {
  //       this.setState({...res});
  //   });
  // }



  // getTableRow(image, item, isFolder){
  //   // var fn = path.basename(item, path.extname(item));
  //   let func = isFolder? this.onDirClick: this.onFileCilck;
  //   func = func.bind(this, item);
  //   return (
  //     <li type="button" className="list-group-item btn btn-primary tag-row" key={item} 
  //                       onClick={func}>
  //       {image}
  //       <span className="row-file-name">{item}</span>
  //     </li>);
  // }

  renderFileList(){
    const {tags = [], 
      authors = [], 
      res, 
      failed} = this.state;
    if(failed || (res && res.status !== 200)){
      return(
        <div className="alert alert-danger" role="alert">
          The server is down. Please check.
        </div>)
    } else if(_.isEmpty(tags) && _.isEmpty(authors)){
      return(
      <div className="alert alert-info" role="alert">
        Loading...
      </div>)
    }  

    const display = this.props.mode === "author"? authors: tags;

    const tagItems = _.keys(display).map((key, index) => {
      const str = `${key} (${display[key]})`;
      return  <li key={index}>{str} </li>;
    });

    return (
      <ul className="list-group">
        {tagItems}
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
      <div className="tag-container">
        {this.renderFileList()}
      </div>
    );
  }
}

TagPage.propTypes = {

};