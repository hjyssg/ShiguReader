import React, { Component } from 'react';
import _ from "underscore";
import Image from 'react-bootstrap/lib/Image';
import PropTypes from 'prop-types';
import loading from './images/loading.png';
import notAvailable from './images/not-available.png';
import Sender from './Sender';

export default class LoadingImage extends Component {
  state = { loaded: false };

  componentDidMount() {
    const {mode} = this.props;
    const api = (mode === "author" || mode === "tag") ? "/api/tagFirstImagePath" :  '/api/firstImage';
    const body = {};

    if(mode === "author" || mode === "tag"){
      body[mode] = this.props.fileName;
    }else{
      body["fileName"] = this.props.fileName;
    }

    Sender.post(api, body,
      (res) => { this.setState({ loaded: true, ...res }); }
    );
  }

  render() {
    if (this.state.failed) {
      return <Image className={`loading-image ${  this.props.className}`} src={notAvailable} thumbnail />;
    } else if (this.state.loaded === false) {
      return <Image className={`loading-image ${  this.props.className}`} src={this.state.image || loading} thumbnail />;
    } else {
      return <Image className={this.props.className} src={this.state.image} thumbnail />;
    }
  }
}

LoadingImage.propTypes = {
  fileName: PropTypes.string,
  className: PropTypes.string,
  mode: PropTypes.string,
};
