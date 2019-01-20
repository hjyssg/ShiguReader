import React, { Component } from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      index: -1
    };
  }

  componentDidMount() {
    document.title = this.props.filePath;
    fetch('/api/extract', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: this.props.filePath })
    })
    .then(_.resHandle)
    .then(res => {
        this.setState({ files: res.files || [], index: 0});
    });
  }

  swithPage(index){
    if(index < 0){
      return;
    } else if(index >= this.state.files.length-1){
      return;
    }
    this.setState({index})
  }

  next(event){
    var index = parseInt(event.target.getAttribute("index")) + 1;
    event.preventDefault();
    this.swithPage(index);
  }

  prev(event){
    var index = parseInt(event.target.getAttribute("index")) - 1;
    event.preventDefault();
    this.swithPage(index);
  }

  renderFileList() {
      const {files, index} = this.state;
      const listItems = files.map((item) => {
        return (<li className="one-book-image-li" key={item}><img className="one-book-image" src={item} alt="book-image"/></li>);
      });
      return (<ul className="one-book-list">{listItems}</ul>);
  }

  render() {
    const {files, index} = this.state;
    if (_.isEmpty(files)) {
      return (
        <div className="one-book-loading">
          { `${_.getFn(this.props.filePath)}  is Loading...`}
        </div>
      );
    }

    if(screen.width > 1500){
      return (<div className="one-book-container">
                    <img className="one-book-image" src={files[index]} alt="book-image"
                         onClick={this.next.bind(this)}
                         onContextMenu={this.prev.bind(this)}
                         index={index}
                    />
              </div>);
    } else {
      return (
        <div>
            {this.renderFileList()}
           <h4 className="one-book-title">{this.props.filePath}</h4>
        </div>
      );
    }
  }
}

OneBook.propTypes = {
  filePath: PropTypes.string
};
