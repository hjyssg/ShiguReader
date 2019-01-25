// @flow
import React, { Component } from 'react';
import LoadingImage from './LoadingImage';
import _ from "underscore";
import PropTypes from 'prop-types';
import Sender from './Sender';
import './style/TagPage.scss';
import { Link } from 'react-router-dom';
import stringHash from "string-hash";
import ErrorPage from './ErrorPage';
import Spinner from './subcomponent/Spinner'

export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = { tags: [], sortByNumber: true };
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
      return (<div className="tag-page-loading"> {<Spinner />}{ "Loading..."}</div>);
    }

    const items = this.props.mode === "author" ? authors : tags;
    const keys = _.keys(items);

    if(this.state.sortByNumber){
      keys.sort((a, b) => items[b] - items[a]);
    }

    const tagItems = keys.map((tag) => {
      const itemText = `${tag} (${items[tag]})`;
      const tagHash = stringHash(tag);
      const url = "/tag/" + tagHash;

      return  (<li key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
                    <Link className="tag-page-list-item-link" to={url}  key={tag}>
                      <center>{itemText}</center>
                      <LoadingImage className="tag-page-thumbnail" fileName={tag} mode={this.props.mode} />
                    </Link>
                  </li>);
      });

    return (
      <ul className="tag-page-list-group container">
        <div className="row">
        {tagItems}
        </div>
      </ul>
    );
  }

  isFailedLoading(){
    return this.res && this.res.failed;
  }

  getTitle(){
    return this.props.mode === "tag"? "By Tags" : "By Authors";
  }

  render() {
    if (this.isFailedLoading()) {
      return <ErrorPage res={this.res.res}/>;
    }
    return (
      <div className="tag-container">
        <center className="location-title">{this.getTitle()}</center>
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
