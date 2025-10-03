// @flow
import React, { Component, useState, useEffect, useContext } from 'react';
// import _ from "underscore";
import './HomePage.scss';
import { getHomeDirectories } from '@api/home';
import { Link } from 'react-router-dom';

import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import ItemsContainer from '@components/common/ItemsContainer';
import ThumbnailPopup from '@components/common/ThumbnailPopup';
import { GlobalContext } from '@context/GlobalContext';

const util = require("@common/util");
const classNames = require('classnames');
const clientUtil = require("@utils/clientUtil");

function renderHighlightedPath(filePath, fallbackText){
    const displayPath = filePath || fallbackText || '';
    const lastSlashIndex = Math.max(displayPath.lastIndexOf('/'), displayPath.lastIndexOf('\\'));
    const prefix = lastSlashIndex >= 0 ? displayPath.slice(0, lastSlashIndex + 1) : '';
    const folderName = lastSlashIndex >= 0 ? displayPath.slice(lastSlashIndex + 1) : displayPath;

    return (
        <span className="explorer-one-line-list-item-text">
            {prefix && <span className="path-prefix">{prefix}</span>}
            <span className="path-highlight">{folderName}</span>
        </span>
    );
}

function getOneLineListItem(icon, fileName, filePath) {
    const highlightedPath = renderHighlightedPath(filePath, fileName);

    return (
        <ThumbnailPopup filePath={filePath}>
            <li className="explorer-one-line-list-item" key={filePath || fileName} title={filePath}>
                {icon}
                {highlightedPath}
            </li>
        </ThumbnailPopup>
        );
}

function getPathItems(items){
    const result = (items||[]).map(item => {
        const toUrl = clientUtil.getExplorerLink(item);
        const text = item;
        const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
        return <Link to={toUrl} key={item}>{result}</Link>;
    })
    return result;
}

const HomePage = () => {
    const globalContext = useContext(GlobalContext) || {};
    const { good_folder, downloadFolder } = globalContext;
    const [res, setRes] = useState(null)

    useEffect(() => {
        async function fetchData() {
            const res = await getHomeDirectories();
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

        const quickAccessList = [...(quickAccess || [])];
        if (good_folder) {
            const index = quickAccessList.indexOf(good_folder);
            if (index > 0) {
                quickAccessList.splice(index, 1);
            }
            if (index !== 0) {
                quickAccessList.unshift(good_folder);
            }
        }

        const hddList = [...(hdd_list || [])];
        if (downloadFolder) {
            const index = hddList.indexOf(downloadFolder);
            if (index > 0) {
                hddList.splice(index, 1);
            }
            if (index !== 0) {
                hddList.unshift(downloadFolder);
            }
        }

        const dirItems = getPathItems(dirs);
        const hddItems = getPathItems(hddList);
        const quickAccessItems = getPathItems(quickAccessList);
        const recentAccessItems = getPathItems(recentAccess);

        return (
            <div className="home-page container">

                {dirItems && <div className="home-section-title"> Watched Folders </div>}
                <ItemsContainer items={dirItems} />

                {quickAccessItems && <div className="home-section-title"> Quick Access </div>} 
                <ItemsContainer items={quickAccessItems} />

                {recentAccessItems && <div className="home-section-title"> Recent Access </div>} 
                <ItemsContainer items={recentAccessItems} />

                {hddItems && <div className="home-section-title"> Hard Drives </div>}
                <ItemsContainer items={hddItems} />
            </div>)
    }
}

export default HomePage;
