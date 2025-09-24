// @flow
import React from 'react';
import classNames from 'classnames';

import './style/ExplorerV2.scss';

import {
    ExplorerToolbar,
    ExplorerSideMenu,
    ExplorerFileList,
    ExplorerPagination,
    getLinkToEhentai,
} from './ExplorerViewComponents';

import type { ExplorerV2Presenter } from './types';

const ExplorerLayoutV2 = ({ info, filteredFiles, filteredVideos }: ExplorerV2Presenter) => {
    const modeClass = info.getMode().replace(' ', '_');
    const cn = classNames('explorer-container-out', 'explorer-v2', modeClass);

    return (
        <div className={cn}>
            {getLinkToEhentai({ info })}
            <ExplorerToolbar info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
            <div className="container-fluid explorer-v2-body">
                <div className="row">
                    <aside className="col-lg-3 order-lg-2 explorer-v2-side">
                        <ExplorerSideMenu info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
                    </aside>
                    <main className="col-lg-9 order-lg-1 explorer-v2-main">
                        <ExplorerFileList info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
                        <ExplorerPagination info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ExplorerLayoutV2;
