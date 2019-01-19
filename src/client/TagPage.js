// @flow
import React, { Component } from 'react';
import _ from "underscore";
import PropTypes from 'prop-types';


export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = { hasError: false, tags: [] };
  }

  componentDidCatch(error) {
    // Display fallback UI
    console.error(error);
    this.setState({ hasError: true });
}

  componentDidMount() {
    if (this.state.loadedHome) {
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

  renderTagList() {
    const {
        tags = [],
        authors = [],
        res,
        failed
    } = this.state;

    if (failed || (res && res.status !== 200)) {
          return (<div className="alert alert-danger" role="alert">The server is down. Please check. </div>);
    } else if (_.isEmpty(tags) && _.isEmpty(authors)) {
      return (<div className="alert alert-info" role="alert">Loading...</div>);
    }

    const display = this.props.mode === "author" ? authors : tags;

    const tagItems = _.keys(display).map((key) => {
      const str = `${key} (${display[key]})`;
      return  (<li key={key}>{str} {' '} </li>);
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
        {this.renderTagList()}
      </div>
    );
  }
}

TagPage.propTypes = {
  mode: PropTypes.oneOf(["tag", "author"])
};
