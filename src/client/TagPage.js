// @flow
import React, { Component } from 'react';
import LoadingImage from './LoadingImage';
import _ from "underscore";
import PropTypes from 'prop-types';
import Sender from './Sender';
import './style/tagPage.css';
import { Link } from 'react-router-dom';
import stringHash from "string-hash";


export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = { tags: [] };
  }

  componentDidCatch(error) {
    // Display fallback UI
    console.error(error);
}

  componentDidMount() {
    if (this.state.loadedHome) {
      return;
    }

    Sender.get('/api/tag', res => {
      if (!res.failed) {
        this.setState({ loadedHome: true, ...res });
      } else {
        this.res = res;
        this.forceUpdate();
      }
    });
  }

  renderTagList() {
    const {
        tags = [],
        authors = []
    } = this.state;

    if (_.isEmpty(tags) && _.isEmpty(authors)) {
      return (<div className="alert alert-info" role="alert">Loading...</div>);
    }

    const display = this.props.mode === "author" ? authors : tags;

    const tagItems = _.keys(display).map((tag) => {
      const displayText = `${tag} (${display[tag]})`;
      const tagHash = stringHash(tag);
      const url = "/tag/" + tagHash;

      return  (<li key={tag}>
                  <LoadingImage className="tag-page-thumbnail" fileName={tag} mode={this.props.mode} />
                  <Link className=" tag-page-list-item-button" to={url}  key={tag}>{displayText}</Link>
                </li>);
    });

    return (
      <ul className="tag-page-list-group">
        {tagItems}
      </ul>
    );
  }

  render() {
    if (this.res && this.res.failed) {
      return <h1>{this.res.res.status + " " + this.res.res.statusText}</h1>;
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

TagPage.propTypes = {
  openDirFunc: PropTypes.func,
};
