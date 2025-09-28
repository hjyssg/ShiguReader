import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@styles/SimilarFilePage.scss';
import { findSimilarFiles } from '@api/search';
import { Link } from 'react-router-dom';
import CenterSpinner from '@components/common/CenterSpinner';
import ErrorPage from '@pages/ErrorPage';
import LoadingImage from '@components/LoadingImage';
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

const SimilarFilePage = ({ location }) => {
  const [items, setItems] = useState([]);
  const [res, setRes] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const queryText = useMemo(() => {
    const search = (location && location.search) || '';
    const parsed = queryString.parse(search);
    return parsed.text || parsed.s || parsed.q || '';
  }, [location && location.search]);

  const trimmedQuery = useMemo(() => (queryText || '').trim(), [queryText]);

  useEffect(() => {
    document.title = 'Similar Files';
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!trimmedQuery) {
      setItems([]);
      setRes(null);
      setIsLoading(false);
      return () => {
        isCancelled = true;
      };
    }

    const fetchResults = async () => {
      setItems([]);
      setIsLoading(true);
      setRes(null);

      const response = await findSimilarFiles(trimmedQuery);
      if (isCancelled) {
        return;
      }

      if (!response.isFailed()) {
        setItems(Array.isArray(response.json) ? response.json : []);
      } else {
        setItems([]);
      }
      setRes(response);
      setIsLoading(false);
    };

    fetchResults();

    return () => {
      isCancelled = true;
    };
  }, [trimmedQuery]);

  const getLinkTarget = useCallback((item) => {
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
  }, []);

  const renderThumbnail = useCallback((item) => {
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
  }, []);

  const renderItems = useCallback((data) => (
    <div className="similar-file-list">
      {data.map((item, index) => {
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
            to={getLinkTarget(item)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="similar-file-thumbnail-wrapper">
              {renderThumbnail(item)}
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
  ), [getLinkTarget, renderThumbnail]);

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

  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <div className="similar-file-container container">
      <div className="similar-file-header">
        <div className="header-title">Similar Files</div>
        <div className="query-chip" title={trimmedQuery}>{trimmedQuery}</div>
      </div>
      {isLoading && <CenterSpinner />}
      {!isLoading && hasItems && renderItems(items)}
      {!isLoading && !hasItems && (
        <div className="similar-file-empty">No similar files found.</div>
      )}
    </div>
  );
};

export default SimilarFilePage;
