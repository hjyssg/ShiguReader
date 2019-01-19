import React, { Component } from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: []
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
        this.setState({ files: res.files || [] });
    });
  }

  renderFileList() {
    const listItems = this.state.files.map((item) => {
      return (<li className="one-book-image-li" key={item}><img className="one-book-image" src={item} alt="book-image"/></li>);
    });
    return (<ul className="one-book-list">{listItems}</ul>);
  }

  render() {
    if (_.isEmpty(this.state.files)) {
      return (
        <div className="one-book-loading">
          { `${_.getFn(this.props.filePath)}  is Loading...`}
        </div>
      );
    }

    return (
      <div>
        <h4 className="one-book-title">{_.getFn(this.props.filePath)}</h4>
          {this.renderFileList()}
        <h4 className="one-book-title">{this.props.filePath}</h4>
      </div>
    );
  }
}

OneBook.propTypes = {
  filePath: PropTypes.string
};
