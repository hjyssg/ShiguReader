
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoadingImage from '@components/LoadingImage';
import _ from "underscore";
import { getAuthors, getGoodAuthorNames, getTags } from '@api/info';
import './TagPage.scss';
import { Link } from 'react-router-dom';
import ErrorPage from '@pages/ErrorPage';
import CenterSpinner from '@components/common/CenterSpinner';
import Pagination from '@components/common/Pagination';
import FileCellTitle from '@components/common/FileCellTitle';
import SortHeader from '@components/common/SortHeader';
import * as Constant from "@common/constant";
import Checkbox from '@components/common/Checkbox';
import * as clientUtil from "@utils/clientUtil";
import * as ClientConstant from "@utils/ClientConstant";
import { TagInfo, AuthorResponse, TagResponse, GoodAuthorNamesResponse } from '@common';

const { getBaseName, getPerPageItemNumber, isSearchInputTextTyping } = clientUtil as any;

const {
    BY_TAG_NAME,
    BY_FILE_NUMBER,
    BY_LATEST_WORK,
    BY_GOOD_SCORE,
    BY_RANDOM
} = ClientConstant as any;

const FILTER_PARODY = "FILTER_PARODY";
const FILTER_COMIKET = "FILTER_COMIKET"
const FILTER_NAME = "FILTER_NAME"

interface TagPageProps {
    mode: "tag" | "author";
}

const metaInfo = [
    { key: "pageIndex", type: "int", defVal: 1 },
    { key: "sortOrder", type: "int", defVal: BY_FILE_NUMBER },
    { key: "isSortAsc", type: "boolean", defVal: false },
    { key: "filterArr", type: "arr", defVal: [FILTER_PARODY] },
    { key: "filterText", type: "str" },
];

const TagPage: React.FC<TagPageProps> = (props) => {
    const [state, setState] = useState(() => {
        const initState = (clientUtil as any).getInitState(metaInfo);
        return {
            ...initState,
            tag_rows: [] as TagInfo[],
            author_rows: [] as TagInfo[],
            authorInfo: null as any,
            tagInfo: null as any,
            perPageItemNum: getPerPageItemNumber(),
            loaded: false,
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

    const requestAuthors = useCallback(async () => {
        let res = await getGoodAuthorNames();
        if (res && !res.isFailed()) {
            setPartialState({
                authorInfo: res.json.authorInfo,
                tagInfo: res.json.tagInfo
            })
        }

        const authorsRes = await getAuthors({ needThumbnail: true })
        if (authorsRes && !authorsRes.isFailed()) {
            setPartialState({
                author_rows: authorsRes.json.author_rows,
                loaded: true
            });
        } else {
            setPartialState({ res: authorsRes });
        }
    }, [setPartialState]);

    const requestTags = useCallback(async () => {
        let res = await getTags({ needThumbnail: true })
        if (res && !res.isFailed()) {
            setPartialState({
                tag_rows: res.json.tag_rows,
                loaded: true
            })
        } else {
            setPartialState({ res });
        }
    }, [setPartialState]);

    const askServer = useCallback(async () => {
        if (props.mode === "author") {
            await requestAuthors();
            await requestTags();
        } else {
            await requestTags();
            await requestAuthors();
        }
    }, [props.mode, requestAuthors, requestTags]);

    useEffect(() => {
        askServer();
    }, [askServer]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (isSearchInputTextTyping()) {
            return;
        }
        const key = event.key.toLowerCase();
        if (key === "arrowright" || key === "d" || key === "l") {
            // next
        } else if (key === "arrowleft" || key === "a" || key === "j") {
            // prev
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        document.title = props.mode === "author" ? "Authors" : "Tags";
    }, [props.mode]);

    const items = useMemo(() => {
        const { sortOrder, filterText, isSortAsc, tag_rows, author_rows, filterArr } = state;
        let rawItems = props.mode === "author" ? author_rows : tag_rows;

        if (props.mode === "tag") {
            rawItems = rawItems.filter((e: TagInfo) => {
                if (filterArr.includes(FILTER_COMIKET) && e.subtype === "comiket") {
                    return true;
                } else if (filterArr.includes(FILTER_PARODY) && e.subtype === "parody") {
                    return true;
                } else if (filterArr.includes(FILTER_NAME) && e.subtype === "name") {
                    return true;
                }
                return false;
            });
        }

        let sortedItems = _.sortBy(rawItems, (item: TagInfo) => item.count);

        const getAuthorCount = (author: string) => (clientUtil as any).getAuthorCount(state.authorInfo, author) || {};
        const getTagCount = (tag: string) => (clientUtil as any).getAuthorCount(state.tagInfo, tag) || {};
        const getScore = (tag: string) => {
            return props.mode === "author" ? getAuthorCount(tag).score || 0 : getTagCount(tag).score || 0;
        };

        if (sortOrder === BY_RANDOM) {
            sortedItems = _.shuffle(sortedItems);
        } else if (sortOrder === BY_FILE_NUMBER) {
            // nothing
        } else if (sortOrder === BY_TAG_NAME) {
            sortedItems.sort((a: TagInfo, b: TagInfo) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
        } else if (sortOrder === BY_LATEST_WORK) {
            sortedItems = _.sortBy(sortedItems, (item: TagInfo) => item.maxTime);
        } else if (sortOrder === BY_GOOD_SCORE) {
            sortedItems.sort((a: TagInfo, b: TagInfo) => {
                const s1 = getScore(a.tag);
                const s2 = getScore(b.tag);
                return s1 === s2 ? a.count - b.count : s1 - s2;
            });
        }

        if (!isSortAsc) {
            sortedItems.reverse();
        }

        sortedItems.forEach((e: TagInfo, ii: number) => {
            e.rank = ii + 1;
        });

        if (_.isString(filterText)) {
            let _text = filterText.toLowerCase();
            sortedItems = sortedItems.filter((e: TagInfo) => e.tag.toLowerCase().indexOf(_text) > -1);
        }

        return sortedItems;
    }, [state, props.mode]);

    const handlePageChange = (index: number) => {
        setPartialState({ pageIndex: index });
    };

    const toggleItemNum = () => {
        let nv = state.perPageItemNum + 12;
        nv = Math.min(nv, 60);
        setPartialState({ perPageItemNum: nv });
    };

    const onSortChange = (sortOrder: any, isSortAsc: boolean) => {
        setPartialState({ sortOrder, isSortAsc });
    };

    const toggleFilterForTagPage = (key: string) => {
        if (state.filterArr[0] === key) return;

        const order_map: any = {
            FILTER_COMIKET: BY_TAG_NAME,
            FILTER_NAME: BY_FILE_NUMBER,
        }

        setPartialState({
            filterArr: [key],
            pageIndex: 1,
            sortOrder: order_map[key] || BY_GOOD_SCORE,
            isSortAsc: false
        });
    };

    const getTooltipStr = (item: TagInfo) => {
        let rows: any[] = [];
        const getAuthorCount = (author: string) => (clientUtil as any).getAuthorCount(state.authorInfo, author) || {};
        const getTagCount = (tag: string) => (clientUtil as any).getAuthorCount(state.tagInfo, tag) || {};

        rows.push(["     "]);
        if (props.mode === "author") {
            rows.push(...(clientUtil as any).convertSimpleObj2tooltipRow(getAuthorCount(item.tag)));
        } else {
            rows.push(...(clientUtil as any).convertSimpleObj2tooltipRow(getTagCount(item.tag)));
        }
        rows.push(["     "]);
        rows.push(["rank", item.rank]);
        rows.push(["latest work", (clientUtil as any).dateFormat_ymd(item.maxTime)]);

        return rows.map(row => row.join(": ")).join("\n")
    };

    const renderTagList = () => {
        const { loaded, pageIndex, perPageItemNum } = state;
        if (_.isEmpty(items)) {
            return loaded ? (
                <center style={{ paddingTop: "100px" }}>
                    <div className="alert alert-info col-6" role="alert" > No Content </div>
                </center>
            ) : <CenterSpinner />;
        }

        const begIndex = (pageIndex - 1) * perPageItemNum;
        const pageItems = items.slice(begIndex, pageIndex * perPageItemNum);

        const tagItems = pageItems.map((item) => {
            const tag = item.tag;
            const itemText = `${tag} (${item.count})`;
            const url = props.mode === "author" ? (clientUtil as any).getAuthorLink(tag) : (clientUtil as any).getTagLink(tag);
            const thumbnailUrl = item.thumbnail && (clientUtil as any).getFileUrl(item.thumbnail);

            return (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
                <div className={"tag-cell"}>
                    <Link target="_blank" className="tag-page-list-item-link" to={url} key={tag}>
                        <FileCellTitle str={itemText} />
                        <LoadingImage
                            title={getTooltipStr(item)}
                            className="tag-page-thumbnail"
                            tag={tag}
                            mode={props.mode}
                            url={thumbnailUrl}
                            filePath=""
                            musicNum={0}
                        />
                    </Link>
                </div>
            </div>);
        });

        return (
            <div className="tag-page-list-group container">
                <div className="row">{tagItems}</div>
            </div>
        );
    };

    const renderFilterMenu = () => {
        if (props.mode === "author") return null;

        return (
            <div className="aji-checkbox-container container">
                <Checkbox onChange={() => toggleFilterForTagPage(FILTER_PARODY)} checked={state.filterArr.includes(FILTER_PARODY)}>Parody</Checkbox>
                <Checkbox onChange={() => toggleFilterForTagPage(FILTER_COMIKET)} checked={state.filterArr.includes(FILTER_COMIKET)}>Comiket</Checkbox>
                <Checkbox onChange={() => toggleFilterForTagPage(FILTER_NAME)} checked={state.filterArr.includes(FILTER_NAME)}>Human Name</Checkbox>
            </div>
        );
    };

    if (state.res && state.res.isFailed()) {
        return <ErrorPage res={state.res} />;
    }

    const sortOptions = props.mode === "author" ? (ClientConstant as any).AUTHOR_SORT_OPTIONS : (ClientConstant as any).TAG_SORT_OPTIONS;

    return (
        <div className="tag-container">
            <center className="location-title">{`${props.mode === "tag" ? "By Tags" : "By Authors"} (${items.length})`}</center>
            <div className="pagination-container">
                <Pagination
                    currentPage={state.pageIndex}
                    itemPerPage={state.perPageItemNum}
                    totalItemNum={items.length}
                    onChange={handlePageChange}
                    onExtraButtonClick={toggleItemNum}
                    linkFunc={(clientUtil as any).linkFunc}
                />
            </div>
            <div className="sort-header-container container">
                <SortHeader sortOptions={sortOptions} selected={state.sortOrder}
                    isSortAsc={state.isSortAsc}
                    onChange={onSortChange}
                    className=""
                    options={sortOptions}
                />
            </div>
            {renderFilterMenu()}
            {renderTagList()}
            <div className="pagination-container">
                <Pagination
                    currentPage={state.pageIndex}
                    itemPerPage={state.perPageItemNum}
                    totalItemNum={items.length}
                    onChange={handlePageChange}
                    onExtraButtonClick={toggleItemNum}
                    linkFunc={(clientUtil as any).linkFunc}
                />
            </div>
        </div>
    );
};

export default TagPage;
