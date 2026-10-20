import React, { useCallback, useEffect, useState } from 'react';
import Checkbox from '@components/common/Checkbox';
import './SearchPage.scss';

const clientUtil = require('@utils/clientUtil');

const SEARCH_BY_TEXT = 'SEARCH_BY_TEXT';
const SEARCH_BY_TAG = 'SEARCH_BY_TAG';
const SEARCH_BY_AUTHOR = 'SEARCH_BY_AUTHOR';
const SEARCH_SIMILAR = 'SEARCH_SIMILAR';

const SearchPage = () => {
    const [searchType, setSearchType] = useState(SEARCH_BY_TEXT);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        document.title = 'Search';
    }, []);

    const isOn = useCallback((type) => searchType === type, [searchType]);

    const onSearchClick = useCallback(() => {
        const trimmedText = (searchText || '').trim();
        if (!trimmedText) {
            return;
        }

        let link = clientUtil.getSearhLink(trimmedText);
        if (searchType === SEARCH_BY_TAG) {
            link = clientUtil.getTagLink(trimmedText);
        } else if (searchType === SEARCH_BY_AUTHOR) {
            link = clientUtil.getAuthorLink(trimmedText);
        } else if (searchType === SEARCH_SIMILAR) {
            link = `/similar-file/?text=${encodeURIComponent(trimmedText)}`;
        }

        window.location.href = link;
    }, [searchText, searchType]);

    const onInputKeydown = useCallback((e) => {
        if (e.which === 13 || e.keyCode === 13) {
            onSearchClick();
            e.preventDefault();
            e.stopPropagation();
        }
    }, [onSearchClick]);

    return (
        <div className="search-page container">
            <div className="location-title">Search</div>
            <div className="search-page-types aji-checkbox-container">
                <Checkbox
                    onChange={setSearchType.bind(null, SEARCH_BY_TEXT)}
                    checked={isOn(SEARCH_BY_TEXT)}
                    title="/search/?s=xxx"
                >
                    search by text
                </Checkbox>
                <Checkbox
                    onChange={setSearchType.bind(null, SEARCH_BY_TAG)}
                    checked={isOn(SEARCH_BY_TAG)}
                    title="/tag/?t=xxx"
                >
                    search by tag
                </Checkbox>
                <Checkbox
                    onChange={setSearchType.bind(null, SEARCH_BY_AUTHOR)}
                    checked={isOn(SEARCH_BY_AUTHOR)}
                    title="/author/?a=xxx"
                >
                    search by author
                </Checkbox>
                <Checkbox
                    onChange={setSearchType.bind(null, SEARCH_SIMILAR)}
                    checked={isOn(SEARCH_SIMILAR)}
                    title="/similar-file/?text=xxx"
                >
                    search similar
                </Checkbox>
            </div>
            <div className="search-page-bar search-bar">
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search.."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={onInputKeydown}
                />
                <button type="button" onClick={onSearchClick} title="Search" className="fa fa-search search-button" />
            </div>
        </div>
    );
};

export default SearchPage;
