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
    Sender.post('/api/firstImage', { fileName: this.props.fileName },
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
  className: PropTypes.string
};
