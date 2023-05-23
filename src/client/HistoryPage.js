import React, { Component } from 'react';
// import PropTypes from 'prop-types';
import './style/HistoryPage.scss';
import Sender from './Sender';
import _ from "underscore";
// import ReactDOM from 'react-dom';
// import Swal from 'sweetalert2';
// import Cookie from "js-cookie";
import { Link } from 'react-router-dom';
import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
const clientUtil = require("./clientUtil");
const { getBaseName } = clientUtil;
const dateFormat = require('dateformat');
// const AdminUtil = require("./AdminUtil");
import { GlobalContext } from './globalContext'
const util = require("@common/util");
const classNames = require('classnames');
import Pagination from './subcomponent/Pagination';
import ThumbnailPopup from './subcomponent/ThumbnailPopup';



function renderHistory(history) {

    const groupByDay = _.groupBy(history, e => {
        let d = new Date(e.time);
        d.setHours(0);
        d.setMinutes(0);
        d.setSeconds(0);
        d.setMilliseconds(0);
        return d.getTime();
    });

    let keys = _.keys(groupByDay);
    keys = _.sortBy(keys, e => -e);

    const historyDom = keys.map(key => {
        const timeStr = dateFormat(new Date(parseInt(key)), "yyyy-mm-dd");
        let items = groupByDay[key];

        items = _.sortBy(items, e => -e.time);

        const dayHistory = items.map((e, ii) => {
            const filePath = e.filePath;
            const toUrl = util.isVideo(filePath)? 
                          clientUtil.getVideoPlayerLink(filePath) : 
                          clientUtil.getOneBookLink(filePath);
            const fn = getBaseName(filePath)||filePath;
            const itemTimeStr = dateFormat(new Date(e.time), "yyyy-mm-dd HH:MM");
            const tooltip = `${fn}\n${itemTimeStr}`

            const cn = classNames("icon", {
                "far fa-file-video": util.isVideo(filePath),
                "fas fa-book": util.isCompress(filePath),
                "far fa-folder": !util.isVideo(filePath) && !util.isCompress(filePath)
            });

            return (
                <Link to={toUrl} key={filePath + ii} className={"history-link"}>
                    <ThumbnailPopup filePath={filePath}>
                        <div className="history-one-line-list-item" key={filePath}>
                            <span className={cn} /> 
                            <span className="file-text" title={tooltip}> {fn}</span>
                        </div>
                    </ThumbnailPopup>
                </Link>);

        })

        return (
            <div className="history-day-section" key={key}>
                <div className="date-text">
                    <span>{timeStr}</span>
                    <span>{`${items.length} items`}</span>
                </div>
                {dayHistory}
            </div>
        )
    })

    return (
        <div className="history-section admin-section">
            <div className="admin-section-title"> Recent Read</div>
            <div className="admin-section-content">
                {historyDom}
            </div>
        </div>)
}

export default class HistoryPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = { pageIndex: 1, totalCount: 0 };
    }

    componentDidMount() {
        this.requestHistory(this.state.pageIndex);
    }

    requestHistory(pageIndex) {
        Sender.post("/api/getHistory", {page: pageIndex-1}, res => {
            let { rows, count } = res.json;
            let history = rows || [];
            history.forEach(e => {
                e.time = parseInt(e.time);
            })
            this.setState({history, res, totalCount: count})
        });
    }


    handlePageChange(index) {
        this.setState({
            pageIndex: index,
            history: []
        });
        this.requestHistory(index);
    }
    
    renderPagination() {
        return (<div className="pagination-container">
            <Pagination ref={ref => this.pagination = ref}
                currentPage={this.state.pageIndex}
                itemPerPage={200}
                totalItemNum={this.state.totalCount}
                onChange={this.handlePageChange.bind(this)}
                // onExtraButtonClick={this.toggleItemNum.bind(this)}
                // linkFunc={clientUtil.linkFunc}
            /></div>);
    }

    render() {
        document.title = "History"
        const {res} = this.state;
        if(!res){
            return (<CenterSpinner />);
        }else if(res.isFailed()){
            return <ErrorPage res={res} />;
        }else{
            return (
                <div className="history-container container">
                    {this.renderPagination()}
                    {renderHistory(this.state.history)}
                </div>)
        }
    }
}

HistoryPage.contextType = GlobalContext;