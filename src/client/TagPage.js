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
import Pagination from 'rc-pagination';
import { Redirect } from 'react-router-dom';
import { isCompress, isImage } from '../util';
const nameParser = require('../name-parser');

const util = require("../util");
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, stringHash } = clientUtil;


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
    this.state = { tags: [], sortByNumber: true, pageIndex: 1 };
    this.perPage = getPerPageItemNumber();
  }

  get pageIndex(){
    return +this.props.match.params.index;
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
    nameParser.sort_file_by_time(files, this.fileToInfo, getBaseName, false, false);

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
    const allFiles = _.keys(fileToInfo).filter(isCompress);
    this.fileToInfo = fileToInfo;
    this.allThumbnails = allThumbnails;

    allFiles.forEach((filePath) => {
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
    });

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
      tagToFiles
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

    var filterText = this.props.filterText && this.props.filterText.toLowerCase();
    if(filterText){
      keys =  keys.filter(e => {
            return e.toLowerCase().indexOf(filterText) > -1;
      });
      keys.sort((a, b) => a.localeCompare(b));
    }

    keys = keys.slice((this.pageIndex-1) * this.perPage, this.pageIndex * this.perPage);
    const t2Files = this.isAuthorMode()? authorToFiles : tagToFiles;

    const tagItems = keys.map((tag) => {
      const itemText = `${tag} (${items[tag]})`;
      const tagHash = stringHash(tag);

      const url = this.isAuthorMode()? ("/author/" + tagHash) :  ("/tag/" + tagHash);
      const thumbnailUrl = this.chooseOneThumbnailForOneTag(t2Files[tag]);

      return  (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
                    <div className={"tag-cell"}>
                      <Link target="_blank" className="tag-page-list-item-link" to={url}  key={tag}>
                        <center>{itemText}</center>
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
    if(this.getItemLength() === 0){
      return;
    }

    return (<Pagination current={this.pageIndex}  
                        ref={ref => this.pagination = ref}
                        pageSize={this.perPage}
                        total={this.getItemLength()} 
                        showQuickJumper={{goButton: true}}
                        itemRender={(item, type) =>{
                          if(type === "page"){
                              let url = location.pathname.split("/");
                              url[2] = item;
                              url = url.join("/");
                              return  <Link to={url}  >{item}</Link>;
                          }else if(type === "prev" || type === "next"){
                              return <a className="rc-pagination-item-link" />
                          }
                        }}
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
