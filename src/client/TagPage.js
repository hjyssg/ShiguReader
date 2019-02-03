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
import Pagination from 'rc-pagination';
const PER_PAGE = 6 * 20;

export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = { tags: [], sortByNumber: true, pageIndex: 1 };
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

  getItems(){
    const {
      tags = [],
      authors = []
    } = this.state;
    return this.props.mode === "author" ? authors : tags;
  }

  getItemLength(){
    return _.keys(this.getItems()).length
  }

  renderTagList() {
    const {
        tags = [],
        authors = []
    } = this.state;

    if (_.isEmpty(tags) && _.isEmpty(authors)) {
      return (<div className="tag-page-loading"> {<Spinner />}{ "Loading..."}</div>);
    }

    const items = this.getItems();
    let keys = _.keys(items);

    if(this.state.sortByNumber){
      keys.sort((a, b) => items[b] - items[a]);
    }

    keys = keys.slice((this.state.pageIndex-1) * PER_PAGE, this.state.pageIndex * PER_PAGE);

    const tagItems = keys.map((tag) => {
      const itemText = `${tag} (${items[tag]})`;
      const tagHash = stringHash(tag);
      const url = this.props.mode === "author"? ("/author/" + tagHash) :  ("/tag/" + tagHash);

      return  (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
                    <div className={"tag-cell"}>
                      <Link className="tag-page-list-item-link" to={url}  key={tag}>
                        <center>{itemText}</center>
                        <LoadingImage className="tag-page-thumbnail" fileName={tag} mode={this.props.mode} />
                      </Link>
                    </div>
                  </div>);
      });

    return (
      <div className="tag-page-list-group container">
        <div className="row">
        {tagItems}
        </div>
      </div>
    );
  }

  isFailedLoading(){
    return this.res && this.res.failed;
  }

  getTitle(){
    let text = this.props.mode === "tag"? "By Tags" : "By Authors";
    return text + " (" + this.getItemLength() + ")";
  }

  handlePageChange(index){
    this.setState({ pageIndex: index});
  }

  renderPagination(){
    if(this.getItemLength() === 0){
      return;
    }

    return (<Pagination current={this.state.pageIndex}  
                        pageSize={PER_PAGE}
                        total={this.getItemLength()} 
                        onChange={this.handlePageChange.bind(this)} />);
  }

  render() {
    if (this.isFailedLoading()) {
      return <ErrorPage res={this.res.res}/>;
    }

    document.title = this.props.mode === "author"? "Authors" : "Tags"; 

    return (
      <div className="tag-container">
        <center className="location-title">{this.getTitle()}</center>
        {this.renderTagList()}
        {this.renderPagination()}
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
