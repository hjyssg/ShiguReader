import React, { Component } from 'react';
import Image from 'react-bootstrap/lib/Image';
import loading from './images/loading.png';
import notAvailable from './images/not-available.png';
import _ from "underscore";

export default class LoadingImage extends Component {
  state = {loaded: false};

  componentDidMount() {
    fetch('/api/firstImage',{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({fileName: this.props.fileName})
    })
    .then(_.resHandle)
    .then(res => {
        this.setState({ loaded: true, image:res.image, failed: res.failed});
    });
  }

  render() {
    if(this.state.failed){
      return <Image className={"loading-image " + this.props.className} src={notAvailable} thumbnail />
    } else if(this.state.loaded === false){
      return <Image className={"loading-image " + this.props.className} src={this.state.image || loading} thumbnail />
    } else{ 
      return <Image className={this.props.className} src={this.state.image} thumbnail />
    }
  }
}
