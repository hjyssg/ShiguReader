
import React, { Component, ReactNode } from 'react';
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
import queryString from 'query-string';
import Checkbox from '@components/common/Checkbox';
import * as clientUtil from "@utils/clientUtil";
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping } = clientUtil as any;

import * as ClientConstant from "@utils/ClientConstant";
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


export default class TagPage extends Component<any, any> {
    metaInfo: any[];
    res: any;
    pagination: any;
    _handleKeyDown: any;

    constructor(prop: any) {
        super(prop);
        this.metaInfo = [
            { key: "pageIndex", type: "int", defVal: 1 },
            { key: "sortOrder", type: "str", defVal: BY_FILE_NUMBER },
            { key: "isSortAsc", type: "boolean", defVal: false },
            { key: "filterArr", type: "arr", defVal: FILTER_PARODY },
            { key: "filterText", type: "str" },
        ];
        this.state = this.getInitState();
    }

    getInitState(reset?: boolean) {
        const initState = clientUtil.getInitState(this.metaInfo, reset);
        return {
            tag_rows: [],
            author_rows: [],
            perPageItemNum: getPerPageItemNumber(),
            mode: this.props.mode,
            ...initState
        }
    }

    setStateAndSetHash(state: any, callback?: () => void) {
        this.setState(state, callback);
        const newState = { ...this.state, ...state };
        clientUtil.saveStateToUrl(this.metaInfo, newState);
    }

    static getDerivedStateFromProps(nextProps: any, prevState: any) {
        if (nextProps.mode && nextProps.mode !== prevState.mode) {
            return {
                pageIndex: 1, filterText: "", mode: nextProps.mode
            }
        }

        if (_.isString(nextProps.filterText) && nextProps.filterText !== prevState.filterText) {
            return {
                filterText: nextProps.filterText,
                pageIndex: 1
            }
        }
        return null;
    }

    askRerender() {
        this.setState({
            rerenderTick: !this.state.rerenderTick
        })
    }

    async requestAuthors() {
        let res = await getGoodAuthorNames();
        if (res && !(res as any).isFailed()) {
            this.setState({
                authorInfo: res.json.authorInfo,
                tagInfo: res.json.tagInfo
            })
        }


        res = await getAuthors({ needThumbnail: true })
        if (res && !(res as any).isFailed()) {
            this.setState({
                author_rows: res.json.author_rows
            })
            this.setState({ loaded: true });
        } else {
            this.res = res;
            this.askRerender();
        }
    }

    async requestTags() {
        let res = await getTags({ needThumbnail: true })
        if (res && !(res as any).isFailed()) {
            this.setState({
                tag_rows: res.json.tag_rows
            })
            this.setState({ loaded: true });
        } else {
            this.res = res;
            this.askRerender();
        }
    }

    getAuthorCount(author: string) {
        return (clientUtil as any).getAuthorCount(this.state.authorInfo, author) || {};
    }

    getTagCount(tag: string) {
        return (clientUtil as any).getAuthorCount(this.state.tagInfo, tag) || {};
    }

    getTooltipStr(item: any) {
        let rows: any[] = [];
        const tag = item.tag;
        rows.push(["     "]);
        if (this.isAuthorMode()) {
            rows.push(...(clientUtil as any).convertSimpleObj2tooltipRow(this.getAuthorCount(tag)));
        } else {
            rows.push(...(clientUtil as any).convertSimpleObj2tooltipRow(this.getTagCount(tag)));
        }
        rows.push(["     "]);
        rows.push(["rank", item.rank]);
        rows.push(["latest work", (clientUtil as any).dateFormat_ymd(item.maxTime)]);

        return rows.map(row => {
            return row.join(": ");
        }).join("\n")
    }

    componentDidMount() {
        if (this.state.loaded) {
            return;
        }

        this.bindUserInteraction();
        this.askServer();
    }

    async askServer() {
        if (this.isAuthorMode()) {
            await this.requestAuthors();
            await this.requestTags();
        } else {
            await this.requestTags();
            await this.requestAuthors();
        }
    }

    bindUserInteraction() {
        this._handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this._handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this._handleKeyDown);
    }

    handleKeyDown(event: any) {
        if (isSearchInputTextTyping()) {
            return;
        }
        const key = event.key.toLowerCase();
        if (key === "arrowright" || key === "d" || key === "l") {
            this.next();
            event.preventDefault();
        } else if (key === "arrowleft" || key === "a" || key === "j") {
            this.prev();
            event.preventDefault();
        }
    }


    getFilteterItems() {
        const {
            sortOrder,
            filterText,
            isSortAsc
        } = this.state;


        let items = this.getItems() || [];

        if (this.isTagMode()) {
            items = items.filter((e: any) => {
                if (this.isOn(FILTER_COMIKET) && e.subtype === "comiket") {
                    return true;
                } else if (this.isOn(FILTER_PARODY) && e.subtype === "parody") {
                    return true;
                } else if (this.isOn(FILTER_NAME) && e.subtype === "name") {
                    return true;
                }
                return false;
            });
        }


        items = _.sortBy(items, (item: any) => item.count);

        if (sortOrder === BY_RANDOM) {
            items = _.shuffle(items);
        } else if (sortOrder === BY_FILE_NUMBER) {
            // nothing
        } else if (sortOrder === BY_TAG_NAME) {
            items.sort((a: any, b: any) => {
                return a.tag.localeCompare(b.tag, undefined, { numeric: true });
            });
        } else if (sortOrder === BY_LATEST_WORK) {
            items = _.sortBy(items, (item: any) => item.maxTime);
        } else if (sortOrder == BY_GOOD_SCORE) {
            items.sort((a: any, b: any) => {
                const s1 = this.getScore(a.tag);
                const s2 = this.getScore(b.tag);
                if (s1 === s2) {
                    return a.count - b.count;
                } else {
                    return s1 - s2;
                }
            })
        }

        if (!isSortAsc) {
            items.reverse();
        }

        items.forEach((e: any, ii: number) => {
            e.rank = ii + 1;
        })

        if (_.isString(filterText)) {
            let _text = filterText.toLowerCase();
            items = items.filter((e: any) => {
                return e.tag.toLowerCase().indexOf(_text) > -1;
            });
        }

        return items;
    }

    getScore(tag: string) {
        if (this.isAuthorMode()) {
            return this.getAuthorCount(tag).score || 0;
        } else {
            return this.getTagCount(tag).score || 0;
        }
    }

    getItems() {
        return this.isAuthorMode() ? this.state.author_rows : this.state.tag_rows;
    }

    isAuthorMode() {
        return this.props.mode === "author";
    }

    isTagMode() {
        return this.props.mode === "tag";
    }

    renderTagList(items: any[]): ReactNode {
        const {
            loaded,
            pageIndex
        } = this.state;

        if (_.isEmpty(items)) {
            if (loaded) {
                return (<center style={{ paddingTop: "100px" }}>
                    <div className="alert alert-info col-6" role="alert" > {`No Content`} </div>
                </center>);
            } else {
                return (<CenterSpinner />);
            }
        }

        const begIndex = (pageIndex - 1) * this.state.perPageItemNum;
        items = items.slice(begIndex, pageIndex * this.state.perPageItemNum);

        const tagItems = items.map((item, ii) => {
            const tag = item.tag;
            const itemText = `${tag} (${item.count})`;
            const url = this.isAuthorMode() ? (clientUtil as any).getAuthorLink(tag) : (clientUtil as any).getTagLink(tag);
            const thumbnailUrl = item.thumbnail && (clientUtil as any).getFileUrl(item.thumbnail);

            return (<div key={tag} className="col-sm-6 col-md-4 col-lg-3 tag-page-list-item">
                <div className={"tag-cell"}>
                    <Link target="_blank" className="tag-page-list-item-link" to={url} key={tag}>
                        <FileCellTitle str={itemText} />
                        <LoadingImage
                            title={this.getTooltipStr(item)}
                            className="tag-page-thumbnail"
                            tag={tag}
                            mode={this.props.mode}
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
                <div className="row">
                    {tagItems}
                </div>
            </div>
        );
    }

    isFailedLoading() {
        return this.res && this.res.isFailed();
    }

    getTitle(keys: any[]) {
        let text = this.isTagMode() ? "By Tags" : "By Authors";
        return text + " (" + keys.length + ")";
    }

    handlePageChange(index: number) {
        if ((window.event as any) && (window.event as any).ctrlKey) {
            return;
        }

        this.setStateAndSetHash({
            pageIndex: index
        });
    }

    next() {
        if (this.pagination && this.pagination.hasNext()) {
            let next = this.state.pageIndex + 1;
            this.handlePageChange(next);
        }
    }

    prev() {
        if (this.pagination && this.pagination.hasPrev()) {
            let next = this.state.pageIndex - 1;
            this.handlePageChange(next);
        }
    }

    toggleItemNum() {
        let nv = this.state.perPageItemNum + 12;
        nv = Math.min(nv, 60);
        this.setStateAndSetHash({
            perPageItemNum: nv
        })
    }

    renderPagination(keys: any[]): ReactNode {

        return (<div className="pagination-container">
            <Pagination ref={(ref: any) => this.pagination = ref}
                currentPage={this.state.pageIndex}
                itemPerPage={this.state.perPageItemNum}
                totalItemNum={keys.length}
                onChange={this.handlePageChange.bind(this)}
                onExtraButtonClick={this.toggleItemNum.bind(this)}
                linkFunc={clientUtil.linkFunc}
            /></div>);
    }

    onSortChange(sortOrder: any, isSortAsc: boolean) {
        this.setStateAndSetHash({ sortOrder, isSortAsc })
    }

    renderSortHeader(): ReactNode {
        let sortOptions;
        if (this.isAuthorMode()) {
            sortOptions = (ClientConstant as any).AUTHOR_SORT_OPTIONS;
        } else {
            sortOptions = (ClientConstant as any).TAG_SORT_OPTIONS;
        }

        return (<div className="sort-header-container container">
            <SortHeader sortOptions={sortOptions} selected={this.state.sortOrder}
                isSortAsc={this.state.isSortAsc}
                onChange={this.onSortChange.bind(this)}
                className=""
                options={sortOptions}
            />
        </div>);
    }

    toggleFilterForTagPage(key: string) {
        let { filterArr } = this.state;
        if (filterArr[0] === key) {
            return;
        }

        const order_map: any = {
            FILTER_COMIKET: BY_TAG_NAME,
            FILTER_NAME: BY_FILE_NUMBER,
        }

        this.setStateAndSetHash({
            filterArr: [key],
            pageIndex: 1,
            sortOrder: order_map[key] || BY_GOOD_SCORE,
            isSortAsc: false
        });
    }

    isOn(key: string) {
        return this.state.filterArr.includes(key);
    }

    renderFilterMenu(): ReactNode {
        if (this.isAuthorMode()) {
            return null;
        }

        const st2 = `Parody`;
        let checkbox2 = (<Checkbox onChange={this.toggleFilterForTagPage.bind(this, FILTER_PARODY)} checked={this.isOn(FILTER_PARODY)}>
            {st2}
        </Checkbox>);

        const st3 = `Comiket`;
        let checkbox3 = (<Checkbox onChange={this.toggleFilterForTagPage.bind(this, FILTER_COMIKET)} checked={this.isOn(FILTER_COMIKET)}>
            {st3}
        </Checkbox>);

        const st4 = `Human Name`;
        let checkbox4 = (<Checkbox onChange={this.toggleFilterForTagPage.bind(this, FILTER_NAME)} checked={this.isOn(FILTER_NAME)}>
            {st4}
        </Checkbox>);

        return (
            <div className="aji-checkbox-container container">
                {checkbox2}
                {checkbox3}
                {checkbox4}
            </div>);
    }

    render(): ReactNode {
        if (this.isFailedLoading()) {
            return <ErrorPage res={this.res} />;
        }

        document.title = this.isAuthorMode() ? "Authors" : "Tags";
        const items = this.getFilteterItems();

        return (
            <div className="tag-container">
                <center className="location-title">{this.getTitle(items)}</center>
                {this.renderPagination(items)}
                {this.renderSortHeader()}
                {this.renderFilterMenu()}
                {this.renderTagList(items)}
                {this.renderPagination(items)}
            </div>
        );
    }
}
