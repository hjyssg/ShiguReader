import React from 'react';

import ExplorerPage from '../ExplorerPage';
import ErrorPage from '../ErrorPage';
import ExplorerLayoutV2 from './ExplorerLayoutV2';

class ExplorerPageV2 extends ExplorerPage {
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
