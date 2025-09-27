// @flow
import React, { Component } from 'react';
import LoadingImage from '@components/LoadingImage';
import _ from "underscore";
import { getAuthors, getGoodAuthorNames, getTags } from '@api/info';
import '@styles/TagPage.scss';
import { Link } from 'react-router-dom';
import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import Pagination from '@components/common/Pagination';
import FileCellTitle from '@components/common/FileCellTitle';
// import { Redirect } from 'react-router-dom';
// import { isCompress, isImage, getCurrentTime } from '@common/util';
// const nameParser = require('@name-parser');
// const classNames = require('classnames');
import SortHeader from '@components/common/SortHeader';
const Constant = require("@common/constant");
const queryString = require('query-string');
import Checkbox from '@components/common/Checkbox';
// const util = require("@common/util");
const clientUtil = require("@utils/clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping } = clientUtil;
// const sortUtil = require("../common/sortUtil");

const ClientConstant = require("@utils/ClientConstant");
const {
  BY_TAG_NAME,
  BY_FILE_NUMBER,
  BY_LATEST_WORK,
  BY_GOOD_SCORE,
  BY_RANDOM
} = ClientConstant;

const FILTER_PARODY = "FILTER_PARODY";
const FILTER_COMIKET = "FILTER_COMIKET"
const FILTER_NAME = "FILTER_NAME"


export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.metaInfo = [
      {key:"pageIndex", type: "int", defVal: 1},
      {key:"sortOrder", type: "str", defVal: BY_FILE_NUMBER},
      {key:"isSortAsc", type: "boolean", defVal: false},
      {key:"filterArr", type: "arr", defVal: FILTER_PARODY},
      {key:"filterText", type: "str"},
    ];
    this.state = this.getInitState();
  }

  getInitState(reset) {
    const initState = clientUtil.getInitState(this.metaInfo, reset);
    return {
      tag_rows: [],
      author_rows: [],
      perPageItemNum: getPerPageItemNumber(),
      mode: this.props.mode,
      ...initState
    }
  }

  setStateAndSetHash(state, callback) {
    this.setState(state, callback);
    const newState = {...this.state, ...state};
    clientUtil.saveStateToUrl(this.metaInfo, newState);
  }

  static getDerivedStateFromProps(nextProps, prevState){
    if (nextProps.mode && nextProps.mode !== prevState.mode) {
        return {
          pageIndex: 1, filterText: "", mode: nextProps.mode
        }
    }
    
    if (_.isString(nextProps.filterText) && nextProps.filterText !== prevState) {
        return {
            filterText: nextProps.filterText,
            pageIndex: 1
        }
    }
    return null;
  }

  askRerender(){
    this.setState({
        rerenderTick: !this.state.rerenderTick
    })
  }

  async requestAuthors(){
    let res = await getGoodAuthorNames();
    if (!res.isFailed()) {
        this.setState({
            authorInfo: res.json.authorInfo,
            tagInfo: res.json.tagInfo
        })
    }


    res = await getAuthors({ needThumbnail: true })
    if (!res.isFailed()) {
      this.setState({
        author_rows: res.json.author_rows
      })
      this.setState({ loaded: true });
    } else {
      this.res = res;
      this.askRerender();
    }
  }

  async requestTags(){
    let res = await getTags({ needThumbnail: true })
    if (!res.isFailed()) {
      this.setState({
        tag_rows: res.json.tag_rows
      })
      this.setState({ loaded: true });
    } else {
      this.res = res;
      this.askRerender();
    }
  }

  getAuthorCount(author) {
    return clientUtil.getAuthorCount(this.state.authorInfo, author) || {};
  }

  getTagCount(tag) {
    return clientUtil.getAuthorCount(this.state.tagInfo, tag) || {};
  }

  getTooltipStr(item){
    let rows = [];
    // rows.push([tag]);
    const tag = item.tag;
    rows.push(["     "]);
    if(this.isAuthorMode()){
      rows.push(...clientUtil.convertSimpleObj2tooltipRow(this.getAuthorCount(tag)));
      // rows.push(["score", this.getScore(tag)]);
    }else{
      rows.push(...clientUtil.convertSimpleObj2tooltipRow(this.getTagCount(tag)));
    }
    rows.push(["     "]);
    rows.push(["rank", item.rank]);
    rows.push(["latest work", clientUtil.dateFormat_ymd(item.maxTime)]);

    return rows.map(row => {
      return row.join(": ");
    }).join("\n")
}

  componentDidMount() {
    if (this.state.loaded) {
      return;
    }

    this.bindUserInteraction();
    this.askServer();
  }

  async askServer(){
    if(this.isAuthorMode()){
      await this.requestAuthors();
      await this.requestTags();
    }else{
      await this.requestTags();
      await this.requestAuthors();
    }
  }

  bindUserInteraction() {
    this._handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);
  }

  componentWillUnmount() {
      document.removeEventListener("keydown", this._handleKeyDown);
  }

  handleKeyDown(event) {
    //this cause input wont work 
    if (isSearchInputTextTyping()) {
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


  getFilteterItems() {
    const {
      sortOrder,
      filterText,
      isSortAsc
    } = this.state;


    let items = this.getItems() || [];

    // tag页面特有的过滤
    if(this.isTagMode()){
      items = items.filter(e => {
        if(this.isOn(FILTER_COMIKET) && e.subtype === "comiket"){
          return true;
        } else if(this.isOn(FILTER_PARODY) && e.subtype === "parody"){
          return true;
        } else  if(this.isOn(FILTER_NAME) && e.subtype === "name"){
          return true;
        }
      });
    }


    // 一律先按file count来
    items = _.sortBy(items, item => item.count);

    //sort
    if (sortOrder === BY_RANDOM) {
      items = _.shuffle(items);
    } else if (sortOrder === BY_FILE_NUMBER) {
      // nothing
    } else if (sortOrder === BY_TAG_NAME) {
      items.sort((a, b) => {
        return a.tag.localeCompare(b.tag, undefined, { numeric: true });
      });
    } else if (sortOrder === BY_LATEST_WORK) {
      items = _.sortBy(items, item => item.maxTime);
    }else  if (sortOrder == BY_GOOD_SCORE){
      // 再按喜好排序
      items.sort((a, b)=> {
          const s1 = this.getScore(a.tag);
          const s2 = this.getScore(b.tag);
          if(s1 === s2){
              return a.count - b.count;
          }else{
              return s1 - s2;
          }
      })
  }

  if (!isSortAsc) {
    items.reverse();
  }

  // 追加property rank
  items.forEach((e, ii) => {
    e.rank = ii+1;
  })

  //by text
  if (_.isString(filterText)) {
    let _text = filterText.toLowerCase();
    items = items.filter(e => {
      return e.tag.toLowerCase().indexOf(_text) > -1;
    });
  }

    return items;
  }

  getScore(tag) {
    if(this.isAuthorMode()){
      return this.getAuthorCount(tag).score || 0;
    }else{
      return this.getTagCount(tag).score || 0;
    }
  }

  getItems() {
    return this.isAuthorMode() ? this.state.author_rows : this.state.tag_rows;
  }

  isAuthorMode() {
    return this.props.mode === "author";
  }

  isTagMode() {
    return this.props.mode === "tag";
  }

  renderTagList(items) {
    const {
      loaded,
      pageIndex
    } = this.state;

    if (_.isEmpty(items)) {
      if (loaded) {
        return (<center style={{ paddingTop: "100px" }}>
          <div className="alert alert-info col-6" role="alert" > {`No Content`} </div>
        </center>);
      } else {
        return (<CenterSpinner />);
      }
    }

    const begIndex = (pageIndex - 1) * this.state.perPageItemNum;
    items = items.slice(begIndex, pageIndex * this.state.perPageItemNum);

    const tagItems = items.map((item, ii) => {
      const tag = item.tag;
      const itemText = `${tag} (${item.count})`;
      const url = this.isAuthorMode() ? clientUtil.getAuthorLink(tag) : clientUtil.getTagLink(tag);
      const thumbnailUrl = item.thumbnail && clientUtil.getFileUrl(item.thumbnail);

      return (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
        <div className={"tag-cell"}>
          <Link target="_blank" className="tag-page-list-item-link" to={url} key={tag}>
            <FileCellTitle str={itemText} />
            <LoadingImage
              title={this.getTooltipStr(item)}
              className="tag-page-thumbnail"
              fileName={tag}
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

  isFailedLoading() {
    return this.res && this.res.isFailed();
  }

  getTitle(keys) {
    let text = this.isTagMode() ? "By Tags" : "By Authors";
    return text + " (" + keys.length + ")";
  }

  handlePageChange(index) {
    if (window.event && window.event.ctrlKey) {
      return;
    }

    this.setStateAndSetHash({
      pageIndex: index
    });
  }

  next() {
    if (this.pagination && this.pagination.hasNext()) {
      let next = this.state.pageIndex + 1;
      this.handlePageChange(next);
    }
  }

  prev() {
    if (this.pagination && this.pagination.hasPrev()) {
      let next = this.state.pageIndex - 1;
      this.handlePageChange(next);
    }
  }

  toggleItemNum() {
    let nv = this.state.perPageItemNum + 12;
    nv = Math.min(nv, 60);
    this.setStateAndSetHash({
      perPageItemNum: nv
    })
  }

  renderPagination(keys) {

    return (<div className="pagination-container">
      <Pagination ref={ref => this.pagination = ref}
        currentPage={this.state.pageIndex}
        itemPerPage={this.state.perPageItemNum}
        totalItemNum={keys.length}
        onChange={this.handlePageChange.bind(this)}
        onExtraButtonClick={this.toggleItemNum.bind(this)}
        linkFunc={clientUtil.linkFunc}
      /></div>);
  }

  onSortChange(sortOrder, isSortAsc) {
    this.setStateAndSetHash({ sortOrder, isSortAsc })
}

  renderSortHeader() {
    let sortOptions;
    if(this.isAuthorMode()){
      sortOptions = ClientConstant.AUTHOR_SORT_OPTIONS;
    }else{
      sortOptions = ClientConstant.TAG_SORT_OPTIONS;
    }

    return (<div className="sort-header-container container">
      <SortHeader sortOptions={sortOptions} selected={this.state.sortOrder} 
                        isSortAsc={this.state.isSortAsc}
                        onChange={this.onSortChange.bind(this)} />
    </div>);
  }

  toggleFilterForTagPage(key) {
      // let filterArr = this.state.filterArr.slice();
      // const index = filterArr.indexOf(key)

      // if (index > -1) {
      //     filterArr.splice(index, 1)
      // } else {
      //     filterArr.push(key);
      // }

      let { filterArr } = this.state;
      if(filterArr[0] == key){
        return;
      }

      const order_map = {
        FILTER_COMIKET: BY_TAG_NAME,
        FILTER_NAME: BY_FILE_NUMBER,
      }
     
      this.setStateAndSetHash({
        filterArr: [key],
        pageIndex: 1,
        sortOrder: order_map[key] || BY_GOOD_SCORE, 
        isSortAsc: false
      });
  }

  isOn(key) {
    return this.state.filterArr.includes(key);
  }

  renderFilterMenu() {
    if(this.isAuthorMode()){
      return;
    }

    const st2 = `Parody`;
    let checkbox2 = (<Checkbox onChange={this.toggleFilterForTagPage.bind(this, FILTER_PARODY)} checked={this.isOn(FILTER_PARODY)}>
        {st2}
    </Checkbox>);

    const st3 = `Comiket`;
    let checkbox3 = (<Checkbox onChange={this.toggleFilterForTagPage.bind(this, FILTER_COMIKET)} checked={this.isOn(FILTER_COMIKET)}>
        {st3}
    </Checkbox>);

    const st4 = `Human Name`;
    let checkbox4 = (<Checkbox onChange={this.toggleFilterForTagPage.bind(this, FILTER_NAME)} checked={this.isOn(FILTER_NAME)}>
        {st4}
    </Checkbox>);

    return (
        <div className="aji-checkbox-container container">
            {checkbox2}
            {checkbox3}
            {checkbox4}
        </div>);
  }

  render() {
    if (this.isFailedLoading()) {
      return <ErrorPage res={this.res} />;
    }

    document.title = this.isAuthorMode() ? "Authors" : "Tags";
    const items = this.getFilteterItems();

    return (
      <div className="tag-container">
        <center className="location-title">{this.getTitle(items)}</center>
        {this.renderPagination(items)}
        {this.renderSortHeader()}
        {this.renderFilterMenu()}
        {this.renderTagList(items)}
        {this.renderPagination(items)}
      </div>
    );
  }
}

