// @flow
import React, { Component, useState, useEffect } from 'react';
// import _ from "underscore";
import './style/HomePage.scss';
import Sender from './Sender';
import { Link } from 'react-router-dom';

import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import ItemsContainer from './subcomponent/ItemsContainer';
import ThumbnailPopup from './subcomponent/ThumbnailPopup';

const util = require("@common/util");
const classNames = require('classnames');
const clientUtil = require("./clientUtil");

function getOneLineListItem(icon, fileName, filePath) {
    return (
        <ThumbnailPopup filePath={filePath}>
            <li className="explorer-one-line-list-item" key={fileName} title={filePath}>
                {icon}
                <span className="explorer-one-line-list-item-text">{fileName}</span>
            </li>
        </ThumbnailPopup>
        );
}

function getPathItems(items){
    const result = (items||[]).map(item => {
        const toUrl = clientUtil.getExplorerV2Link(item);
        const text = item;
        const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
        return <Link to={toUrl} key={item}>{result}</Link>;
    })
    return result;
}

const HomePage = () => {
    const [res, setRes] = useState(null)

    useEffect(() => {
        async function fetchData() {
            const res = await Sender.getWithPromise("/api/homePagePath");
            if (!res.isFailed()) {
                setRes(res);
            }
        }
        fetchData();
    }, []); 

    document.title = "ShiguReader";

    if(!res){
        return (<CenterSpinner />);
    }else if(res.isFailed()){
        return <ErrorPage res={res} />;
    }else {
        let {dirs, hdd_list, quickAccess, recentAccess } = res.json;
        const dirItems = getPathItems(dirs);
        const hddItems = getPathItems(hdd_list);
        const quickAccessItems = getPathItems(quickAccess);
        const recentAccessItems = getPathItems(recentAccess);

        return (
            <div className="home-page container">

                {dirItems && <div className="home-section-title"> Scanned And Under Watch </div>} 
                <ItemsContainer items={dirItems} />

                {quickAccessItems && <div className="home-section-title"> Quick Access </div>} 
                <ItemsContainer items={quickAccessItems} />

                {recentAccessItems && <div className="home-section-title"> Recent Access </div>} 
                <ItemsContainer items={recentAccessItems} />

                {hddItems && <div className="home-section-title"> Hard Drivers </div>} 
                <ItemsContainer items={hddItems} />
            </div>)
    }
}

export default HomePage;