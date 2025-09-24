import React from 'react';

import ExplorerPage from '../ExplorerPage';
import ErrorPage from '../ErrorPage';
import ExplorerLayoutV2 from './ExplorerLayoutV2';

const Constant = require('@common/constant');
const { MODE_EXPLORER } = Constant;

class ExplorerPageV2 extends ExplorerPage {
    getMode(props) {
        const mode = super.getMode(props);
        if (mode) {
            return mode;
        }

        const _props = props || this.props;
        const pathname = _props && _props.location && _props.location.pathname;
        if (pathname && pathname.includes('/explorerV2/')) {
            return MODE_EXPLORER;
        }

        return mode;
    }

    buildPresenter() {
        return {
            info: this,
            filteredFiles: this.getFilteredFiles(),
            filteredVideos: this.getFilteredVideos(),
        };
    }

    render() {
        this.setWebTitle();

        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res} />;
        }

        const presenter = this.buildPresenter();
        return <ExplorerLayoutV2 {...presenter} />;
    }
}

export default ExplorerPageV2;
