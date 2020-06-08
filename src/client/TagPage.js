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
import SortHeader from './subcomponent/SortHeader';
const Constant = require("@common/constant");

const util = require("@common/util");
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping } = clientUtil;
const sortUtil = require("../common/sortUtil");

const {
  FILE_NUMBER_DOWN,
  FILE_NUMBER_UP,
  NAME_UP,
  NAME_DOWN,
  SORT_RANDOMLY
} = Constant;


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
                  sortOrder: FILE_NUMBER_DOWN,
                   pageIndex: (+this.props.match.params.index) || 1 };
    this.perPage = getPerPageItemNumber();
  }

  componentWillReceiveProps(nextProps){
    if(this.props.mode !== nextProps.mode || this.props.filterText !== nextProps.filterText){
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
    //this cause input wont work 
    if(isSearchInputTextTyping()){
      return;
    }
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
    const groupSet = {};

    for(let filePath in fileToInfo){
      if(fileToInfo.hasOwnProperty(filePath) && isCompress(filePath)){
        const fileName = getBaseName(filePath);
        const result = nameParser.parse(fileName);
        if (result && result.group) {
          const group = result.group.toLowerCase();
          groupSet[group] = true;
        }
      }
    }

    for(let filePath in fileToInfo){
      if(fileToInfo.hasOwnProperty(filePath) && isCompress(filePath)){
        const fileName = getBaseName(filePath);
        const result = nameParser.parse(fileName);
        if (result) {
            (result.authors||[]).forEach(author => {
              //some author is actually group, fake author
              author = author.toLowerCase();
              if(!groupSet[author]){
                addOne(authors, author);
                addToArray(authorToFiles, author, filePath );
              }
            })

            result.tags.forEach(tag => {
              tag = tag.toLowerCase();
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

  getFilteterItems(){
    const {
      sortOrder
    } = this.state;

    let { filterText } = this.props;

    const items = this.getItems() || [];
    let keys = _.keys(items);

    if(_.isString(filterText)){
      filterText = filterText.toLowerCase();
      keys =  keys.filter(e => {
            return e.toLowerCase().indexOf(filterText) > -1;
      });
    }

    if (sortOrder.includes(SORT_RANDOMLY)){
      keys = _.shuffle(keys);
    } else if(sortOrder === FILE_NUMBER_DOWN || sortOrder === FILE_NUMBER_UP){
      keys = _.sortBy(keys, a => -items[a]);

      if(sortOrder === FILE_NUMBER_UP){
        keys.reverse();
      }
    }else if(sortOrder === NAME_DOWN || sortOrder === NAME_UP){
      keys.sort((a, b) => {
          return a.localeCompare(b);
      });

      if(sortOrder === NAME_DOWN){
          keys.reverse();
      }
    }
    return keys;
  }

  getItems(){
    return this.isAuthorMode()? this.state.authors : this.state.tags;
  }

  isAuthorMode(){
    return this.props.mode === "author";
  }

  renderTagList(keys) {
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
    keys = keys.slice((pageIndex-1) * this.perPage, pageIndex * this.perPage);
    const t2Files = this.isAuthorMode()? authorToFiles : tagToFiles;
    const isAuthorMode = this.isAuthorMode();
    const kk = isAuthorMode? "authors" : "tags";


    const tagItems = keys.map((tag) => {

      //because the tag is stored as lowercase
      //we need to find the correct spelling
      let strArr = [];
      t2Files[tag].forEach(filePath => {
        const fileName = getBaseName(filePath);
        const result = nameParser.parse(fileName);
        result[kk].forEach(vv => strArr.push(vv));
      });

      strArr = strArr.filter(e => e.toLowerCase() === tag.toLowerCase());
      const byFeq = _.countBy(strArr, e => e);
      strArr = _.sortBy(_.keys(byFeq), e => -byFeq[e]);
      const displayTag = strArr[0];

      const itemText = `${displayTag} (${items[tag]})`;
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

  getTitle(keys){
    let text = this.props.mode === "tag"? "By Tags" : "By Authors";
    return text + " (" + keys.length + ")";
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

  renderPagination(keys){
    return (<div className="pagination-container">
              <Pagination ref={ref => this.pagination = ref}
              currentPage={this.state.pageIndex}  
              itemPerPage={this.perPage}
              totalItemNum={keys.length} 
              onChange={this.handlePageChange.bind(this)} 
              /></div>);
  }

  onSortChange(e){
    this.setState({sortOrder: e})
  }

  renderSortHeader(){
    let sortOptions = Constant.TAG_SORT_OPTIONS;
    return (<div className="sort-header-container container"> 
        <SortHeader  options={sortOptions} value={this.state.sortOrder} onChange={this.onSortChange.bind(this)} />
        </div>);
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

    const keys = this.getFilteterItems();

    return (
      <div className="tag-container">
        <center className="location-title">{this.getTitle(keys)}</center>
        {this.renderPagination(keys)}
        {this.renderSortHeader()}
        {this.renderTagList(keys)}
        {this.renderPagination(keys)}
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
