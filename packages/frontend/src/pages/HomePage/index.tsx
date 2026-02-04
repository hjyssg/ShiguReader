
import React, { useState, useEffect, useContext, ReactNode } from 'react';
import './HomePage.scss';
import { getHomeDirectories } from '@api/home';
import { Link } from 'react-router-dom';

import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import ItemsContainer from '@components/common/ItemsContainer';
import ThumbnailPopup from '@components/common/ThumbnailPopup';
import { GlobalContext } from '@context/GlobalContext';

import * as util from "@common/util";
import classNames from 'classnames';
import * as clientUtil from "@utils/clientUtil";

function renderHighlightedPath(filePath: string, fallbackText: string) {
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

function getOneLineListItem(icon: ReactNode, fileName: string, filePath: string) {
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

function getPathItems(items: string[]) {
    const result = (items || []).map(item => {
        const toUrl = (clientUtil as any).getExplorerLink(item);
        const text = item;
        const result = getOneLineListItem(<i className="far fa-folder"></i>, text, item);
        return <Link to={toUrl} key={item}>{result}</Link>;
    })
    return result;
}

const HomePage = () => {
    const globalContext = useContext(GlobalContext) || {};
    const { good_folder, downloadFolder } = globalContext as any;
    const [res, setRes] = useState<any>(null)

    useEffect(() => {
        async function fetchData() {
            const res = await getHomeDirectories();
            if (res && !(res as any).isFailed()) {
                setRes(res);
            }
        }
        fetchData();
    }, []);

    document.title = "ShiguReader";

    if (!res) {
        return (<CenterSpinner />);
    } else if ((res as any).isFailed()) {
        return <ErrorPage res={res} />;
    } else {
        let { dirs, hdd_list, quickAccess, recentAccess } = res.json;

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
