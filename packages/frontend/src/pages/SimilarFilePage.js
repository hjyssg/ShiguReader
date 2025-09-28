import React, { Component } from 'react';
import '@styles/SimilarFilePage.scss';
import { findSimilarFiles } from '@api/search';
import { Link } from 'react-router-dom';
import CenterSpinner from '@components/common/CenterSpinner';
import ErrorPage from '@pages/ErrorPage';
import LoadingImage from '@components/LoadingImage';
import { GlobalContext } from '@context/GlobalContext';
const queryString = require('query-string');
const clientUtil = require('@utils/clientUtil');
const classNames = require('classnames');
const _ = require('underscore');

const EXACT_MATCH_SCORE = 100;
const LIKELY_MATCH_SCORE = 70;
const SAME_AUTHOR_SCORE = 20;

function getScoreInfo(score) {
  if (!_.isNumber(score)) {
    return { label: 'Unknown', className: 'unknown' };
  }

  if (score >= EXACT_MATCH_SCORE) {
    return { label: 'Exact Match', className: 'exact' };
  }

  if (score >= LIKELY_MATCH_SCORE) {
    return { label: 'Likely Match', className: 'likely' };
  }

  if (score >= SAME_AUTHOR_SCORE) {
    return { label: 'Same Author', className: 'author' };
  }

  return { label: 'Low Confidence', className: 'low' };
}

export default class SimilarFilePage extends Component {
  static contextType = GlobalContext;

  constructor(props) {
    super(props);
    this.state = {
      items: [],
      res: null,
      isLoading: false,
      queryText: this.getQueryText(props)
    };
  }

  componentDidMount() {
    this.fetchResults(this.state.queryText);
  }

  componentDidUpdate(prevProps) {
    const prevQuery = this.getQueryText(prevProps);
    const nextQuery = this.getQueryText(this.props);
    if (prevQuery !== nextQuery) {
      this.setState({
        queryText: nextQuery,
        res: null,
        items: []
      });
      this.fetchResults(nextQuery);
    }
  }

  componentWillUnmount() {
    this.isUnmounted = true;
  }

  getQueryText(props) {
    const _props = props || this.props;
    const search = (_props && _props.location && _props.location.search) || '';
    const parsed = queryString.parse(search);
    return parsed.text || parsed.s || parsed.q || '';
  }

  async fetchResults(text) {
    const trimmed = (text || '').trim();
    this.latestQuery = trimmed;

    if (!trimmed) {
      this.setState({
        items: [],
        res: null,
        isLoading: false
      });
      return;
    }

    this.setState({
      isLoading: true,
      res: null
    });

    const res = await findSimilarFiles(trimmed);
    if (this.isUnmounted || this.latestQuery !== trimmed) {
      return;
    }

    if (!res.isFailed()) {
      const items = Array.isArray(res.json) ? res.json : [];
      this.setState({
        res,
        items,
        isLoading: false
      });
    } else {
      this.setState({
        res,
        items: [],
        isLoading: false
      });
    }
  }

  getLinkTarget(item) {
    const filePath = item.filePath;
    if (filePath) {
      if (item.isVideo) {
        return clientUtil.getVideoPlayerLink(filePath);
      }
      if (item.isFolder) {
        return clientUtil.getExplorerLink(filePath);
      }
      return clientUtil.getBookReadLink(filePath);
    }

    return clientUtil.getSearhLink(item.fn);
  }

  renderThumbnail(item) {
    const filePath = item.filePath;
    if (filePath && (item.isFolder || item.isCompress)) {
      const mode = item.isFolder ? 'folder' : 'zip';
      return (
        <LoadingImage
          className="similar-file-thumbnail-image"
          fileName={filePath}
          mode={mode}
          title={item.fn}
        />
      );
    }

    const placeholderClass = classNames(
      'similar-file-thumbnail-placeholder',
      'loading-image',
      {
        'far fa-file-video': item.isVideo,
        'fas fa-book': item.isCompress,
        'far fa-folder': item.isFolder,
        'far fa-file-alt': !item.isVideo && !item.isCompress && !item.isFolder,
      }
    );

    return (
      <div
        className={placeholderClass}
        title={item.fn}
      />
    );
  }

  renderItems(items) {
    return (
      <div className="similar-file-list">
        {items.map((item, index) => {
          const filePath = item.filePath;
          const displayName = item.fn || filePath || `Result ${index + 1}`;
          const key = filePath || `${displayName}-${index}`;
          const dirText = filePath ? clientUtil.getDir(filePath) : '';
          const scoreValue = _.isNumber(item.score) ? Math.round(item.score) : '-';
          const scoreInfo = getScoreInfo(item.score);
          const typeLabel = item.isVideo
            ? 'Video'
            : item.isFolder
              ? 'Folder'
              : item.isCompress
                ? 'Archive'
                : '';

          return (
            <Link
              key={key}
              className="similar-file-item"
              to={this.getLinkTarget(item)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="similar-file-thumbnail-wrapper">
                {this.renderThumbnail(item)}
              </div>
              <div className="similar-file-item-content">
                <div className="file-name" title={displayName}>{displayName}</div>
                <div className="file-meta">
                  <span className={classNames('score-tag', scoreInfo.className)}>{scoreInfo.label}</span>
                  <span className="score-value">{`Score: ${scoreValue}`}</span>
                  {typeLabel && <span className="type-tag">{typeLabel}</span>}
                  {filePath ? (
                    <span className="file-path" title={filePath}>{dirText || filePath}</span>
                  ) : (
                    <span className="file-path missing">Path not recorded</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  render() {
    document.title = 'Similar Files';
    const { queryText, isLoading, res, items } = this.state;
    const trimmedQuery = (queryText || '').trim();

    if (!trimmedQuery) {
      return (
        <div className="similar-file-container container">
          <div className="similar-file-header">
            <div className="header-title">Similar Files</div>
          </div>
          <div className="similar-file-empty">Add ?text=xxx to the url or open from the helper script.</div>
        </div>
      );
    }

    if (res && res.isFailed()) {
      return <ErrorPage res={res} />;
    }

    if (isLoading && !res) {
      return (
        <div className="similar-file-container container">
          <div className="similar-file-header">
            <div className="header-title">Similar Files</div>
            <div className="query-chip" title={trimmedQuery}>{trimmedQuery}</div>
          </div>
          <CenterSpinner />
        </div>
      );
    }

    return (
      <div className="similar-file-container container">
        <div className="similar-file-header">
          <div className="header-title">Similar Files</div>
          <div className="query-chip" title={trimmedQuery}>{trimmedQuery}</div>
        </div>
        {isLoading && <CenterSpinner />}
        {items && items.length > 0 ? (
          this.renderItems(items)
        ) : (
          <div className="similar-file-empty">No similar files found.</div>
        )}
      </div>
    );
  }
}
