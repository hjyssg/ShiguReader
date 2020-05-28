// @flow
import React, { Component } from 'react';
import LoadingImage from './LoadingImage';
import _ from "underscore";
import PropTypes from 'prop-types';
import Sender from './Sender';
import './style/TagPage.scss';
import { Link } from 'react-router-dom';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import Pagination from './subcomponent/Pagination';
import FileCellTitle from './subcomponent/FileCellTitle';
import { Redirect } from 'react-router-dom';
import { isCompress, isImage, getCurrentTime } from '@common/util';
const nameParser = require('@name-parser');
const classNames = require('classnames');

const util = require("@common/util");
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, } = clientUtil;
const sortUtil = require("../common/sortUtil");


function addOne(table, key) {
  if(!key){
      return;
  }
  if (!table[key]) {
      table[key] = 1;
  } else {
      table[key] = table[key] + 1;
  }
}

function addToArray(table, key, value){
  if(!key || !value){
    return;
  }
  if (!table[key]) {
      table[key] = [value];
  } else {
      table[key].push(value);
  }
}

export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = { tags: [], 
                   sortByNumber: true,
                   pageIndex: (+this.props.match.params.index) || 1 };
    this.perPage = getPerPageItemNumber();
  }

  componentWillReceiveProps(nextProps){
    if(this.props.mode !== nextProps.mode){
      this.setState({pageIndex: 1})
    }
  }


  componentDidMount() {
    if (this.state.loaded) {
      return;
    }

    this.bindUserInteraction();

    Sender.post('/api/allInfo', { needThumbnail: true}, res => {
      if (!res.failed) {
        this.setItems(res);
        this.setState({ loaded: true });
      } else {
        this.res = res;
        this.forceUpdate();
      }
    });
  }

  bindUserInteraction(){
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  componentWillUnmount(){
      document.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === "arrowright" || key === "d" || key === "l") {
      this.next();
      event.preventDefault();
    } else if (key === "arrowleft" || key === "a" || key === "j") {
      this.prev();
      event.preventDefault();
    }
  }

  chooseOneThumbnailForOneTag = function(files){
    files = sortUtil.sort_file_by_time(files, this.fileToInfo, getBaseName, false, false);
    let result;
    files.some(e => {
      const thumbnail = this.allThumbnails[e];
      if(thumbnail && isImage(thumbnail)){
        result = thumbnail;
        return true;
      }
    });

    return result;
  }
  
  setItems(res){
    const { fileToInfo = {}, allThumbnails = {} } = res;
    const tags = {};
    const authors = {};
    const authorToFiles = {};
    const tagToFiles = {};
    this.fileToInfo = fileToInfo;
    this.allThumbnails = allThumbnails;

    const beginTime = getCurrentTime();

    for(let filePath in fileToInfo){
      if(fileToInfo.hasOwnProperty(filePath) && isCompress(filePath)){
        const fileName = getBaseName(filePath);
        const result = nameParser.parse(fileName);
        if (result) {
            addOne(authors, result.author);
            addToArray(authorToFiles, result.author, filePath );
            result.tags.forEach(tag => {
              addOne(tags, tag);
              addToArray(tagToFiles, tag, filePath);
            });
        }
      }
    }

    const timeSpent = getCurrentTime() - beginTime;
    // console.log(timeSpent)

    this.setState({
      tags,
      authors,
      authorToFiles,
      tagToFiles
    })
  }

  getItems(){
    return this.isAuthorMode()? this.state.authors : this.state.tags;
  }

  getItemLength(){
    return _.keys(this.getItems()).length
  }

  isAuthorMode(){
    return this.props.mode === "author";
  }

  renderTagList() {
    const {
      tags = [],
      authors = [],
      loaded,
      authorToFiles,
      tagToFiles,
      pageIndex
    } = this.state;

    if ( _.isEmpty(tags) && _.isEmpty(authors)) {
      if(loaded){
        return (<center style={{paddingTop: "100px"}}> 
                    <div className="alert alert-info col-6" role="alert" > {`No Content`} </div>
                </center>);
      }else{
        return (<CenterSpinner/>);
      }
    }

    const items = this.getItems();
    let keys = _.keys(items);


    if(this.state.sortByNumber){
      keys.sort((a, b) => items[b] - items[a]);
    }

    var filterText = _.isString(this.props.filterText) && this.props.filterText.toLowerCase();
    if(filterText){
      keys =  keys.filter(e => {
            return e.toLowerCase().indexOf(filterText) > -1;
      });
      keys.sort((a, b) => a.localeCompare(b));
    }

    keys = keys.slice((pageIndex-1) * this.perPage, pageIndex * this.perPage);
    const t2Files = this.isAuthorMode()? authorToFiles : tagToFiles;

    const tagItems = keys.map((tag) => {
      const itemText = `${tag} (${items[tag]})`;
      const url = this.isAuthorMode()? clientUtil.getAuthorLink(tag) :  clientUtil.getTagLink(tag);
      const thumbnailUrl = this.chooseOneThumbnailForOneTag(t2Files[tag]);
    

      return  (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
                    <div className={"tag-cell"}>
                      <Link target="_blank" className="tag-page-list-item-link" to={url}  key={tag}>
                        <FileCellTitle str={itemText}/>
                        <LoadingImage isThumbnail 
                                      className="tag-page-thumbnail" fileName={tag} 
                                      mode={this.props.mode} 
                                      url={thumbnailUrl} />
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
    if(window.event && window.event.ctrlKey){
      return;
    }
    const temp = this.props.mode === "tag"? "/tagPage/": "/authorPage/";
    const path = temp + index;
    this.redirect = path;
    this.setState({
      pageIndex: index
    });
  }

  next(){
    if(this.pagination && this.pagination.hasNext()){
        let next = this.state.pageIndex+1;
        this.handlePageChange(next);
    }
  }

  prev(){
      if(this.pagination && this.pagination.hasPrev()){
          let next = this.state.pageIndex-1;
          this.handlePageChange(next);
      }
  }

  renderPagination(){
    return (<div className="pagination-container">
              <Pagination ref={ref => this.pagination = ref}
              currentPage={this.state.pageIndex}  
              itemPerPage={this.perPage}
              totalItemNum={this.getItemLength()} 
              onChange={this.handlePageChange.bind(this)} 
              /></div>);
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

    document.title = this.isAuthorMode()? "Authors" : "Tags"; 

    return (
      <div className="tag-container">
        <center className="location-title">{this.getTitle()}</center>
        {this.renderPagination()}
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
