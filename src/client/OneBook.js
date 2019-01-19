import React, { Component } from 'react';
import _ from 'underscore';
import Alert from 'react-bootstrap/lib/Alert';

export default class OneBook extends Component {
  constructor(props){
    super(props);
    this.state = {
      files: []
    };
  }

  componentDidMount() {
    fetch('/api/extract',{
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({fileName: this.props.filePath})
    })
    .then(_.resHandle)
    .then(res => {
        this.setState({ files: res.files||[] });
    });
  }

  renderFileList(){
    if(_.isEmpty(this.state.files)){
      return(
      <div className="spinner-border" role="status">
        <span className="sr-only">Loading...</span>
      </div>);
    }

    const listItems = this.state.files.map(function(item, index){
      return (<li className="one-book-image-li" key={index}><img className="one-book-image" src={item}/></li>);
    });
    return (<ul className="one-book-list">{listItems}</ul>);
  }

  render() {
    return (
    <div>
      <h2 className="one-book-title">{this.props.filePath}</h2>
      {this.renderFileList()}
      <h2 className="one-book-title">{this.props.filePath}</h2>
    </div>);
  }
}
