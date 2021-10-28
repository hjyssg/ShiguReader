import React, { Component } from 'react';
import '../style/Pagination.scss';
const classNames = require('classnames');

export default class Pagination extends Component {
  constructor(props) {
    super()
    this.state = {
      textValue: props.currentPage
    }
  }

  static getDerivedStateFromProps(nextProps, prevState){
    return { textValue: nextProps.currentPage }
  }

  onChange = (e) => {
    if(window.event.ctrlKey){
      return;
    }
    e.preventDefault();
    const { onChange } = this.props;
    const value = typeof e === "number" ? e : parseInt(e.target.textContent.trim());
    onChange && onChange(value);
  }

  hasPrev() {
    return this.props.currentPage > 1;
  }

  prev = () => {
    const { onChange, currentPage } = this.props;
    onChange && onChange(Math.max(currentPage - 1, 1));
  }

  hasNext() {
    return this.props.currentPage < this.getTotalPage();
  }

  next = () => {
    const { onChange, currentPage } = this.props;
    onChange && onChange(Math.min(currentPage + 1, this.getTotalPage()));
  }

  getTotalPage() {
    const {
      itemPerPage,
      totalItemNum,
    } = this.props
    return Math.ceil(totalItemNum / itemPerPage);
  }

  render() {
    const {
      currentPage,
      itemPerPage,
      totalItemNum,
      onChange,
      linkFunc,
      className,
      onExtraButtonClick
    } = this.props

    const { textValue } = this.state;

    const BUFFER_SIZE = window.screen.width < 750 ? 2 : 5; //the items will 1 + BUFFER_SIZE*2
    const totalPage = this.getTotalPage();

    if (totalPage <= 1) {
      return null;
    }

    const prevButton = (<div className="pagination-item page-link prev" onClick={this.prev}> prev </div>)
    const nextButton = (<div className="pagination-item page-link next" onClick={this.next}> next </div>)

    let right = Math.max(currentPage - BUFFER_SIZE, 1);
    let left = Math.min(currentPage + BUFFER_SIZE, totalPage);

    if (currentPage - right < BUFFER_SIZE) {
      const toLeft = BUFFER_SIZE - (currentPage - right);
      left = Math.min(currentPage + BUFFER_SIZE + toLeft, totalPage);
    }

    if (left - currentPage < BUFFER_SIZE) {
      const toRight = BUFFER_SIZE - (left - currentPage);
      right = Math.max(currentPage - BUFFER_SIZE - toRight, 1);
    }

    let contentList = [1];
    if (right > 2) {
      contentList.push("...");
    }

    for (let ii = right; ii <= left; ii++) {
      if (!contentList.includes(ii)) {
        contentList.push(ii);
      }
    }
    if (left < totalPage - 1) {
      contentList.push("...");
    }

    if (!contentList.includes(totalPage)) {
      contentList.push(totalPage);
    }

    const itemDoms = contentList.map((e, ii) => {
      const isEllipsis = e === "...";
      const cn = classNames("pagination-item", {
        active: e === currentPage,
        "disabled": isEllipsis
      })
      return (<li className={cn} key={ii + e} > 
                <a onClick={isEllipsis ? () => { } : this.onChange} href={linkFunc && !isEllipsis && linkFunc(e-1)} >{e} </a>
              </li>)
    })


    const pageInput = (
      <div className="page-jump">
        <input
          type='text'
          value={textValue}
          onKeyPress={e => {
            if (e.which === 13 || e.keyCode === 13) {
              //enter key
              this.onChange(parseInt(textValue));
              e.preventDefault();
              e.stopPropagation();
            }
          }}

          onChange={e => {
            const val = e.target.value
            this.setState({ textValue: val })
          }}
        />
        <div>{`/${totalPage}`}</div>
      </div>)

    const extraButton = (<div className="pagination-extra-button"
      onClick={onExtraButtonClick}
      title="click to show more">
      {`${itemPerPage} per page`}
    </div>)

    return (<ul className="pagination">
      {prevButton}
      {itemDoms}
      {nextButton}
      {pageInput}
      {extraButton}
    </ul>);
  }
}


