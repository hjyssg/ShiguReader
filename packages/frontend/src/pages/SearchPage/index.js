import React, { useCallback, useEffect, useState } from 'react';
import Checkbox from '@components/common/Checkbox';
import './SearchPage.scss';

const clientUtil = require('@utils/clientUtil');

const SEARCH_TYPE_FILE = 'FILE';
const SEARCH_TYPE_AUTHOR = 'AUTHOR';
const SEARCH_TYPE_SIMILAR = 'SIMILAR';

const SearchPage = () => {
    const [searchTypes, setSearchTypes] = useState([SEARCH_TYPE_FILE, SEARCH_TYPE_AUTHOR, SEARCH_TYPE_SIMILAR]);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        document.title = 'Search';
    }, []);

    const isOn = useCallback((type) => searchTypes.includes(type), [searchTypes]);

    const toggleType = useCallback((type) => {
        setSearchTypes((prev) => {
            const next = prev.slice();
            const index = next.indexOf(type);

            if (index > -1) {
                next.splice(index, 1);
            } else {
                next.push(type);
            }

            return next;
        });
    }, []);

    const onSearchClick = useCallback(() => {
        const trimmedText = (searchText || '').trim();
        if (!trimmedText) {
            return;
        }

        const links = [];
        if (isOn(SEARCH_TYPE_FILE)) {
            links.push(clientUtil.getSearhLink(trimmedText));
        }
        if (isOn(SEARCH_TYPE_AUTHOR)) {
            links.push(clientUtil.getAuthorLink(trimmedText));
        }
        if (isOn(SEARCH_TYPE_SIMILAR)) {
            links.push(`/similar-file/?text=${encodeURIComponent(trimmedText)}`);
        }

        links.forEach((link, index) => {
            if (index === 0) {
                window.location.href = link;
                return;
            }
            window.open(link, '_blank');
        });
    }, [isOn, searchText]);

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
                    onChange={toggleType.bind(null, SEARCH_TYPE_FILE)}
                    checked={isOn(SEARCH_TYPE_FILE)}
                    title="/search/?s=xxx"
                >
                    Search Files
                </Checkbox>
                <Checkbox
                    onChange={toggleType.bind(null, SEARCH_TYPE_AUTHOR)}
                    checked={isOn(SEARCH_TYPE_AUTHOR)}
                    title="/author/?a=xxx"
                >
                    Search Author
                </Checkbox>
                <Checkbox
                    onChange={toggleType.bind(null, SEARCH_TYPE_SIMILAR)}
                    checked={isOn(SEARCH_TYPE_SIMILAR)}
                    title="/similar-file/?text=xxx"
                >
                    Similar File
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
