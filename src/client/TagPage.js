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
const queryString = require('query-string');
import Checkbox from './subcomponent/Checkbox';


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


const FILTER_PARODY = "FILTER_PARODY";
const FILTER_COMIKET = "FILTER_COMIKET"

export default class TagPage extends Component {
  constructor(prop) {
    super(prop);
    this.state = this.getInitState();

  }

  getInitState(reset) {
    const parsed = reset ? {} : queryString.parse(location.hash);
    const pageIndex = parseInt(parsed.pageIndex) || 1;
    const sortOrder = parsed.sortOrder || FILE_NUMBER_DOWN;
    let filterArr = parsed.filterArr || [FILTER_PARODY];
    if (_.isString(filterArr)) {
        filterArr = [ filterArr ];
    }

    return {
      perPageItemNum: getPerPageItemNumber(),
      tag_rows: [],
      author_rows: [],
      pageIndex,
      sortOrder,
      filterArr,
      filterText: parsed.filterText || "",
    }
  }

  setStateAndSetHash(state, callback) {
    const obj = Object.assign({}, this.state, state);
    const obj2 = {};
    ["pageIndex", "sortOrder", "filterText", "filterArr"].forEach(key => {
      obj2[key] = obj[key];
    })

    clientUtil.replaceUrlHash(queryString.stringify(obj2));
    this.setState(state, callback);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.mode !== nextProps.mode) {
      this.setStateAndSetHash({ pageIndex: 1, filterText: "" })
    }

    if (_.isString(nextProps.filterText) && nextProps.filterText !== this.state.filterText) {
      this.setStateAndSetHash({
        pageIndex: 1,
        filterText: nextProps.filterText
      })
    }
  }

  componentDidMount() {
    if (this.state.loaded) {
      return;
    }

    this.bindUserInteraction();

    Sender.post('/api/tagInfo', { needThumbnail: true }, res => {
      if (!res.isFailed()) {
        this.setState({
          tag_rows: res.json.tag_rows,
          author_rows: res.json.author_rows
        })
        this.setState({ loaded: true });
      } else {
        this.res = res;
        this.forceUpdate();
      }
    });
  }

  bindUserInteraction() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
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
      filterText
    } = this.state;


    let items = this.getItems() || [];

    //by text
    if (_.isString(filterText)) {
      let _text = filterText.toLowerCase();
      items = items.filter(e => {
        return e.tag.toLowerCase().indexOf(_text) > -1;
      });
    }

    //sort
    if (sortOrder.includes(SORT_RANDOMLY)) {
      items = _.shuffle(items);
    } else if (sortOrder === FILE_NUMBER_DOWN || sortOrder === FILE_NUMBER_UP) {
      items = _.sortBy(items, a => -items.count);

      if (sortOrder === FILE_NUMBER_UP) {
        items.reverse();
      }
    } else if (sortOrder === NAME_DOWN || sortOrder === NAME_UP) {
      items.sort((a, b) => {
        return a.tag.localeCompare(b.tag);
      });

      if (sortOrder === NAME_DOWN) {
        items.reverse();
      }
    }

    if(this.isTagMode()){
      items = items.filter(e => {
        if(this.isOn(FILTER_COMIKET) && e.subtype === "comiket"){
          return true;
        }

        if(this.isOn(FILTER_PARODY) && e.subtype === "parody"){
          return true;
        }
      });
    }

    return items;
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

    items = items.slice((pageIndex - 1) * this.state.perPageItemNum, pageIndex * this.state.perPageItemNum);

    const tagItems = items.map((item) => {
      const tag = item.tag;
      const itemText = `${tag} (${item.count})`;
      const url = this.isAuthorMode() ? clientUtil.getAuthorLink(tag) : clientUtil.getTagLink(tag);
      const thumbnailUrl = item.thumbnail && clientUtil.getFileUrl(item.thumbnail);

      return (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
        <div className={"tag-cell"}>
          <Link target="_blank" className="tag-page-list-item-link" to={url} key={tag}>
            <FileCellTitle str={itemText} />
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
      /></div>);
  }

  onSortChange(e) {
    this.setStateAndSetHash({ sortOrder: e })
  }

  renderSortHeader() {
    let sortOptions = Constant.TAG_SORT_OPTIONS;
    return (<div className="sort-header-container container">
      <SortHeader options={sortOptions} value={this.state.sortOrder} onChange={this.onSortChange.bind(this)} />
    </div>);
  }

  toggleFilter(key) {
      let filterArr = this.state.filterArr.slice();
      const index = filterArr.indexOf(key)

      if (index > -1) {
          filterArr.splice(index, 1)
      } else {
          filterArr.push(key);
      }

      // console.log(filterArr)
      this.setStateAndSetHash({
          filterArr,
          pageIndex: 1
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
    let checkbox2 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_PARODY)} checked={this.isOn(FILTER_PARODY)}>
        {st2}
    </Checkbox>);

    const st3 = `Comiket`;
    let checkbox3 = (<Checkbox onChange={this.toggleFilter.bind(this, FILTER_COMIKET)} checked={this.isOn(FILTER_COMIKET)}>
        {st3}
    </Checkbox>);


    return (
        <div className="aji-checkbox-container container">
            {checkbox2}
            {checkbox3}
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

TagPage.propTypes = {
  mode: PropTypes.oneOf(["tag", "author"])
};

TagPage.propTypes = {
  openDirFunc: PropTypes.func,
  filterText: PropTypes.string
};
