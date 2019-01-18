import React, { Component } from 'react';
import Image from 'react-bootstrap/lib/Image';
import loading from './images/loading.png'


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
    .then(list => {
        this.setState({ loaded: true});
    });
  }

  render() {
    if(this.state.loaded === false){
      return <Image className="loading-image" src={loading} thumbnail />
    }
    return this.renderFileList();
  }
}
