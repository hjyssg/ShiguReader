// @flow
import React, { Component, useState, useEffect } from 'react';
import _ from "underscore";
// import './style/Explorer.scss';
// import PropTypes from 'prop-types';
// import LoadingImage from './LoadingImage';
import Sender from './Sender';
import { Link } from 'react-router-dom';

// const userConfig = require('@config/user-config');
import ErrorPage from './ErrorPage';
// import FileChangeToolbar from './subcomponent/FileChangeToolbar';
import CenterSpinner from './subcomponent/CenterSpinner';
const util = require("@common/util");
// const queryString = require('query-string');
// import Pagination from './subcomponent/Pagination';
import ItemsContainer from './subcomponent/ItemsContainer';
// import SortHeader from './subcomponent/SortHeader';
// import Breadcrumb from './subcomponent/Breadcrumb';
// import FileCellTitle from './subcomponent/FileCellTitle';
// import Checkbox from './subcomponent/Checkbox';
// import { getFileUrl } from './clientUtil';
// const nameParser = require('@name-parser');
const classNames = require('classnames');
// const Constant = require("@common/constant");
const clientUtil = require("./clientUtil");
// const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil;
// const { isVideo, isCompress, isImage, isMusic } = util;
// const sortUtil = require("../common/sortUtil");
// const AdminUtil = require("./AdminUtil");

function getOneLineListItem(icon, fileName, filePath) {
    return (
        <li className="explorer-one-line-list-item" key={fileName} title={filePath}>
            {icon}
            <span className="explorer-one-line-list-item-text">{fileName}</span>
        </li>);
}


const HomePage = () => {
    const [res, setRes] = useState(null)

    useEffect(() => {
        Sender.postWithPromise("/api/homePagePath", {}).then(res => setRes(res));
    }, []); 

    document.title = "ShiguReader";

    if(!res){
        return (<CenterSpinner />);
    }else if(res.isFailed()){
        return <ErrorPage res={res} />;
    }else {
        const {dirs, hdd_list, quickAccess } = res.json;
        const dirItems = dirs.map((item) => {
            const toUrl = clientUtil.getExplorerLink(item);
            const text = item;
            const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
            return <Link to={toUrl} key={item}>{result}</Link>;
        });

        const hddItems = hdd_list.map((item) => {
                // const toUrl = clientUtil.getExplorerLink(item);
                // F: 的时候，会莫名其妙显示shigureader文件夹的内容
                const toUrl = clientUtil.getExplorerLink(item + "\\\\");
                const text = item;
                const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
                return <Link to={toUrl} key={item}>{result}</Link>;
            });

        const quickAccessItems = quickAccess.map(item => {
                const toUrl = clientUtil.getExplorerLink(item);
                const text = item;
                const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
                return <Link to={toUrl} key={item}>{result}</Link>;
            })

        return (
            <div className="home-page container">
                 <ItemsContainer items={dirItems}  />
                 <ItemsContainer items={hddItems} />
                 <ItemsContainer items={quickAccessItems} />
            </div>)
    }
}

export default HomePage;