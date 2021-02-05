import React, { Component } from 'react';
// import PropTypes from 'prop-types';
import './style/HistoryPage.scss';
import Sender from './Sender';
import _ from "underscore";
// import ReactDOM from 'react-dom';
// import Swal from 'sweetalert2';
// import Cookie from "js-cookie";
import { Link } from 'react-router-dom';
// import RadioButtonGroup from './subcomponent/RadioButtonGroup';
const clientUtil = require("./clientUtil");
const { getBaseName } = clientUtil;
const dateFormat = require('dateformat');
// const AdminUtil = require("./AdminUtil");
import { GlobalContext } from './globalContext'
const util = require("@common/util");
const classNames = require('classnames');

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
        const timeStr = dateFormat(new Date(parseInt(key)), "dddd, mmmm dS, yyyy");
        let items = groupByDay[key];

        items = _.sortBy(items, e => -e.time);

        const dayHistory = items.map(e => {
            const filePath = e.filePath;
            const toUrl = util.isVideo(filePath)? 
                          clientUtil.getVideoPlayerLink(filePath) : 
                          clientUtil.getOneBookLink(filePath);

            const cn = classNames("icon", {
                "far fa-file-video": util.isVideo(filePath),
                "fas fa-book": util.isCompress(filePath),
                "far fa-folder": !util.isVideo(filePath) && !util.isCompress(filePath)
            });

            return (
                <Link to={toUrl} key={filePath} className={"history-link"}>
                    <div className="history-one-line-list-item" key={filePath}>
                        <span className={cn} /> 
                        <span className="file-text" title={filePath}> {getBaseName(filePath)||filePath}</span>
                    </div>
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
        this.state = { };
    }

    componentDidMount() {
        this.requestHistory();
    }

    requestHistory() {
        Sender.post("/api/getHistory", {}, res => {
            let { history } = res.json;
            history = history || [];
            history.forEach(e => {
                e.time = parseInt(e.time);
            })
            this.setState({history})
        });
    }

    render() {
        document.title = "History"
        return (
            <div className="history-container container">
                {renderHistory(this.state.history)}
            </div>)
    }
}

HistoryPage.contextType = GlobalContext;