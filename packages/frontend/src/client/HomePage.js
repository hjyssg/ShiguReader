// @flow
import React, { useState, useEffect } from 'react';
import './style/HomePage.scss';
import Sender from './Sender';
import { Link } from 'react-router-dom';

import ErrorPage from './ErrorPage';
import CenterSpinner from './subcomponent/CenterSpinner';
import ItemsContainer from './subcomponent/ItemsContainer';
import ThumbnailPopup from './subcomponent/ThumbnailPopup';

const clientUtil = require("./clientUtil");

function getOneLineListItem(icon, fileName, filePath) {
    return (
        <ThumbnailPopup filePath={filePath}>
            <li className="explorer-one-line-list-item" key={filePath} title={filePath}>
                {icon}
                <span className="explorer-one-line-list-item-text">{fileName}</span>
            </li>
        </ThumbnailPopup>
        );
}

function getPathItems(items){
    const result = (items||[]).map(item => {
        const toUrl = clientUtil.getExplorerLink(item);
        const text = clientUtil.getBaseName(item) || item;
        const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
        return <Link to={toUrl} key={item}>{result}</Link>;
    })
    return result;
}

const HomeSection = ({ title, items }) => {
    if (!items || items.length === 0) {
        return null;
    }

    return (
        <section className="home-section-panel">
            <div className="home-section-title"> {title} </div>
            <ItemsContainer items={items} className="home-section-items" noContainerPadding />
        </section>
    );
};

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
            <div className="home-page">
                <HomeSection title="Watched Folders" items={dirItems} />
                <HomeSection title="Quick Access" items={quickAccessItems} />
                <HomeSection title="Recent Access" items={recentAccessItems} />
                <HomeSection title="Hard Drives" items={hddItems} />
            </div>)
    }
}

export default HomePage;