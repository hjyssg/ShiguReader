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
import CenterSpinner from './subcomponent/CenterSpinner';
import Pagination from 'rc-pagination';
import { Redirect } from 'react-router-dom';

const util = require("../util");

export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = { tags: [], sortByNumber: true };
    this.perPage = util.getPerPageItemNumber();
  }

  get pageIndex(){
    return +this.props.match.params.index;
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
      return (<CenterSpinner/>);
    }

    const items = this.getItems();
    let keys = _.keys(items);

    if(this.state.sortByNumber){
      keys.sort((a, b) => items[b] - items[a]);
    }

    // if(this.props.mode === "tag"){
      //pick comiket in first page

    var filterText = this.props.filterText && this.props.filterText.toLowerCase();
    if(filterText){
      keys =  keys.filter(e => {
            return e.toLowerCase().indexOf(filterText) > -1;
      });
      keys.sort((a, b) => a.localeCompare(b));
    }

    keys = keys.slice((this.pageIndex-1) * this.perPage, this.pageIndex * this.perPage);

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
    const temp = this.props.mode === "tag"? "/tagPage/": "/authorPage/";
    const path = temp + index;
    this.redirect = path;
    this.forceUpdate();
  }

  renderPagination(){
    if(this.getItemLength() === 0){
      return;
    }

    return (<Pagination current={this.pageIndex}  
                        pageSize={this.perPage}
                        total={this.getItemLength()} 
                        onChange={this.handlePageChange.bind(this)} />);
  }

  render() {
    if(this.redirect){
      const path = this.redirect;
      this.redirect = "";
      return (<Redirect
        to={{
            pathname: path,
      }}/>);
    }

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
  filterText: PropTypes.string
};
