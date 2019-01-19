import React, { Component } from 'react';
import Image from 'react-bootstrap/lib/Image';
import loading from './images/loading.png'
const classNames = require('classnames');


export default class ImagePage extends Component {
  state = {loaded: false};

  componentDidMount() {
    // this.props.fileName

    fetch('/api/firstImage',{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({fileName: this.props.fileName})
    })
    .then(res => {
      return res.json();
    })
    .then(res => {
        this.setState({ loaded: true, image:res.image});
    });
  }

  render() {
    if(this.state.loaded === false){
      return <Image className={"loading-image " + this.props.className} src={this.state.image || loading} thumbnail />
    } else{ 
      return <Image className={this.props.className} src={this.state.image} thumbnail />
    }
  }
}
