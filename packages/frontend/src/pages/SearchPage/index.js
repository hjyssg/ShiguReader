import React, { Component } from 'react';
import Checkbox from '@components/common/Checkbox';
import './SearchPage.scss';

const clientUtil = require('@utils/clientUtil');

const SEARCH_TYPE_FILE = 'FILE';
const SEARCH_TYPE_AUTHOR = 'AUTHOR';
const SEARCH_TYPE_SIMILAR = 'SIMILAR';

export default class SearchPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            searchTypes: [SEARCH_TYPE_FILE, SEARCH_TYPE_AUTHOR, SEARCH_TYPE_SIMILAR]
        };
    }

    componentDidMount() {
        document.title = 'Search';
    }

    toggleType(type) {
        const searchTypes = this.state.searchTypes.slice();
        const index = searchTypes.indexOf(type);

        if (index > -1) {
            searchTypes.splice(index, 1);
        } else {
            searchTypes.push(type);
        }

        this.setState({ searchTypes });
    }

    isOn(type) {
        return this.state.searchTypes.includes(type);
    }

    onSearchClick() {
        let searchText = clientUtil.getSearchInputText();
        if (searchText.trim) {
            searchText = searchText.trim();
        }

        if (!searchText) {
            return;
        }

        const links = [];
        if (this.isOn(SEARCH_TYPE_FILE)) {
            links.push(clientUtil.getSearhLink(searchText));
        }
        if (this.isOn(SEARCH_TYPE_AUTHOR)) {
            links.push(clientUtil.getAuthorLink(searchText));
        }
        if (this.isOn(SEARCH_TYPE_SIMILAR)) {
            links.push(`/similar-file/?text=${encodeURIComponent(searchText)}`);
        }

        links.forEach((link, index) => {
            if (index === 0) {
                window.location.href = link;
                return;
            }
            window.open(link, '_blank');
        });
    }

    onInputKeydown(e) {
        if (e.which === 13 || e.keyCode === 13) {
            this.onSearchClick();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    render() {
        return (
            <div className="search-page container">
                <div className="location-title">Search</div>
                <div className="search-page-types aji-checkbox-container">
                    <Checkbox
                        onChange={this.toggleType.bind(this, SEARCH_TYPE_FILE)}
                        checked={this.isOn(SEARCH_TYPE_FILE)}
                        title="/search/?s=xxx"
                    >
                        Search Files
                    </Checkbox>
                    <Checkbox
                        onChange={this.toggleType.bind(this, SEARCH_TYPE_AUTHOR)}
                        checked={this.isOn(SEARCH_TYPE_AUTHOR)}
                        title="/author/?a=xxx"
                    >
                        Search Author
                    </Checkbox>
                    <Checkbox
                        onChange={this.toggleType.bind(this, SEARCH_TYPE_SIMILAR)}
                        checked={this.isOn(SEARCH_TYPE_SIMILAR)}
                        title="/similar-file/?text=xxx"
                    >
                        Similar File
                    </Checkbox>
                </div>
                <div className="search-page-bar search-bar">
                    <input className="search-input" type="text" placeholder="Search.." onKeyDown={this.onInputKeydown.bind(this)} />
                    <div onClick={this.onSearchClick.bind(this)} title="Search" className="fa fa-search search-button" />
                </div>
            </div>
        );
    }
}
