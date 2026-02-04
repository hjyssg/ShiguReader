
import React, { useState, useEffect, useCallback } from 'react';
import './HistoryPage.scss';
import { listHistory } from '@api/history';
import _ from "underscore";
import { Link } from 'react-router-dom';
import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import Pagination from '@components/common/Pagination';
import ThumbnailPopup from '@components/common/ThumbnailPopup';
import * as clientUtil from "@utils/clientUtil";
import * as util from "@common/util";
import { HistoryRecord, HistoryResponse } from '@common';
const classNames = require('classnames');

const { getBaseName } = clientUtil as any;

const metaInfo = [
    { key: "pageIndex", type: "int", defVal: 1 },
];

const HistoryPage: React.FC = () => {
    const [state, setState] = useState(() => {
        const initState = (clientUtil as any).getInitState(metaInfo);
        return {
            ...initState,
            history: [] as HistoryRecord[],
            totalCount: 0,
            res: null as any
        }
    });

    const setPartialState = useCallback((partialState: any) => {
        setState(prev => {
            const newState = { ...prev, ...partialState };
            (clientUtil as any).saveStateToUrl(metaInfo, newState);
            return newState;
        });
    }, []);

    const requestHistory = useCallback(async (pageIndex: number) => {
        const res = await listHistory(pageIndex - 1);
        if (!res.isFailed()) {
            let { rows, count } = res.json as HistoryResponse;
            let history = rows || [];
            history.forEach(e => {
                e.time = (typeof e.time === 'string' ? parseInt(e.time) : e.time);
            })
            setPartialState({ history, res, totalCount: count })
        } else {
            setPartialState({ history: [], res, totalCount: 0 });
        }
    }, [setPartialState]);

    useEffect(() => {
        document.title = "History"
        requestHistory(state.pageIndex);
    }, [requestHistory, state.pageIndex]);

    const handlePageChange = (index: number) => {
        setPartialState({
            pageIndex: index,
            history: []
        });
    };

    const renderHistoryContent = (history: HistoryRecord[]) => {
        const groupByDay = _.groupBy(history, e => {
            let d = new Date(e.time);
            d.setHours(0);
            d.setMinutes(0);
            d.setSeconds(0);
            d.setMilliseconds(0);
            return d.getTime();
        });

        let keys = _.keys(groupByDay);
        keys = _.sortBy(keys, e => -parseInt(e));

        const historyDom = keys.map(key => {
            const timeStr = (clientUtil as any).dateFormat_ymd(new Date(parseInt(key)));
            let items = groupByDay[key];

            items = _.sortBy(items, e => -e.time);

            const dayHistory = items.map((e, ii) => {
                const filePath = e.filePath;
                const toUrl = (util as any).isVideo(filePath) ?
                    (clientUtil as any).getVideoPlayerLink(filePath) :
                    (clientUtil as any).getBookReadLink(filePath);
                const fn = getBaseName(filePath) || filePath;
                const itemTimeStr = (clientUtil as any).dateFormat_v1(new Date(e.time));
                const tooltip = `${fn}\n${itemTimeStr}`

                const cn = classNames("icon", {
                    "far fa-file-video": (util as any).isVideo(filePath),
                    "fas fa-book": (util as any).isCompress(filePath),
                    "far fa-folder": !(util as any).isVideo(filePath) && !(util as any).isCompress(filePath)
                });

                return (
                    <Link target="_blank" to={toUrl} key={filePath + ii} className={"history-link"}>
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
                <div className="admin-section-content">
                    {historyDom}
                </div>
            </div>)
    }

    const { res, history, pageIndex, totalCount } = state;

    if (!res) {
        return (<CenterSpinner />);
    } else if (res.isFailed()) {
        return <ErrorPage res={res} />;
    } else {
        return (
            <div className="history-container container">
                <div className="pagination-container">
                    <Pagination
                        currentPage={pageIndex}
                        itemPerPage={200}
                        totalItemNum={totalCount}
                        onChange={handlePageChange}
                    />
                </div>
                {renderHistoryContent(history)}
            </div>)
    }
}

export default HistoryPage;
