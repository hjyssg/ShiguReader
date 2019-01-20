import React, { Component } from 'react';
import _ from "underscore";
import Image from 'react-bootstrap/lib/Image';
import PropTypes from 'prop-types';
import loading from './images/loading.png';
import notAvailable from './images/not-available.png';
import Sender from './Sender';
// const VisibilitySensor = require('react-visibility-sensor').default;

const VisibilitySensor = require('react-visibility-sensor').default;


export default class LoadingImage extends Component {
  state = { loaded: false };

  componentDidMount() {
    
  }

  onChange(isVisible){
    // console.log(isVisible, this.props.fileName)
    if(isVisible && !this.state.loaded & !this.loading){
      const {mode} = this.props;
      const api = (mode === "author" || mode === "tag") ? "/api/tagFirstImagePath" :  '/api/firstImage';
      const body = {};

      if(mode === "author" || mode === "tag"){
        body[mode] = this.props.fileName;
      }else{
        body["fileName"] = this.props.fileName;
      }

      this.loading = true;

      Sender.post(api, body,
        (res) => { this.setState({ loaded: true, ...res }); }
      );
    }
  }

  render() {
    let content;
    if (this.state.failed) {
      const cn = "loading-image  " + this.props.className;
      content = (<Image ref={e=>{this.dom = e && e.node}} className={cn} src={notAvailable} thumbnail />);
    } else if (this.state.loaded === false) {
      content = (<Image className={`loading-image ${  this.props.className}`} src={this.state.image || loading} thumbnail />);
    } else {
      content = (<Image className={this.props.className} src={this.state.image} thumbnail />);
    }

    //early
    return (
      <VisibilitySensor offset={{bottom:-1000}} onChange={this.onChange.bind(this)}>
        {content}
      </VisibilitySensor>
    );
  }
}

LoadingImage.propTypes = {
  fileName: PropTypes.string,
  className: PropTypes.string,
  mode: PropTypes.string,
};
