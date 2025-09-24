// @flow
import React from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';

import CenterSpinner from '../subcomponent/CenterSpinner';
import ItemsContainer from '../subcomponent/ItemsContainer';
import Pagination from '../subcomponent/Pagination';
import SortHeader from '../subcomponent/SortHeader';
import Breadcrumb from '../subcomponent/Breadcrumb';
import FileCellTitle from '../subcomponent/FileCellTitle';
import Checkbox from '../subcomponent/Checkbox';
import LoadingImage from '../LoadingImage';
import ThumbnailPopup from '../subcomponent/ThumbnailPopup';

import {
    NoScanAlertArea,
    FileCountPanel,
    getOneLineListItem,
    LinkToEHentai,
    SimpleFileListPanel,
    SingleZipItem,
} from '../ExplorerPageUI';

const userConfig = require('@config/user-config');
const Constant = require('@common/constant');
const clientUtil = require('../clientUtil');
const ExplorerUtil = require('../ExplorerUtil');
const ClientConstant = require('../ClientConstant');

const { getBaseName } = clientUtil;
const { MODE_EXPLORER, MODE_AUTHOR, MODE_TAG, MODE_SEARCH } = Constant;
const {
    BY_FOLDER,
} = ClientConstant;

const _ = require('underscore');

export const ExplorerSingleZipItem = ({ info, filePath }) => {
    const text = getBaseName(filePath);
    const toUrl = clientUtil.getOneBookLink(filePath);
    const thumbnailurl = info.getThumbnailUrl(filePath);

    if (info.state.noThumbnail) {
        return (
            <Link target="_blank" to={toUrl} key={filePath} className={""}>
                <ThumbnailPopup filePath={filePath} url={thumbnailurl}>
                    {getOneLineListItem(<i className="fas fa-book"></i>, text, filePath, info)}
                </ThumbnailPopup>
            </Link>
        );
    }

    return <SingleZipItem key={filePath} filePath={filePath} info={info} />;
};

export const ExplorerPageRangeSlider = ({ info }) => {
    const { pageNumRange } = info.state;
    const [min, max] = pageNumRange;
    const maxRange = info.getMaxPageForSlider();

    const marks = {
        [min]: `${min}`,
        [maxRange]: `${maxRange}+`,
        [Math.min(maxRange, max)]: `${Math.min(maxRange, max)}`,
    };

    return (
        <div className="page-range-slider container">
            <div className="page-range-slider-label">Page Range</div>
            <RangeSlider
                min={0}
                max={maxRange}
                step={10}
                value={[min, Math.min(maxRange, max)]}
                onInput={info.onPageRangeChange.bind(info)}
            />
            <div className="page-range-slider-marks">
                {Object.entries(marks).map(([key, label]) => (
                    <span key={key} className="page-range-slider-mark">{label}</span>
                ))}
            </div>
        </div>
    );
};

export const ExplorerToggleThumbnailButton = ({ info }) => {
    const cn = classNames('btn btn-outline-primary exp-top-button', {
        active: !info.state.noThumbnail,
    });

    return (
        <div className={cn} onClick={() => info.setStateAndSetHash({ noThumbnail: !info.state.noThumbnail })}>
            {info.state.noThumbnail ? 'Show Thumbnail' : 'Hide Thumbnail'}
        </div>
    );
};

export const ExplorerToggleFolderThumbnailButton = ({ info }) => {
    const cn = classNames('btn btn-outline-primary exp-top-button', {
        active: info.state.showFolderThumbnail,
    });

    return (
        <div className={cn} onClick={() => info.setStateAndSetHash({ showFolderThumbnail: !info.state.showFolderThumbnail })}>
            {info.state.showFolderThumbnail ? 'Hide Folder Thumbnail' : 'Show Folder Thumbnail'}
        </div>
    );
};

export const ExplorerToggleVideoButton = ({ info }) => {
    const cn = classNames('btn btn-outline-primary exp-top-button', {
        active: info.state.showVideo,
    });

    return (
        <div className={cn} onClick={() => info.setStateAndSetHash({ showVideo: !info.state.showVideo })}>
            {info.state.showVideo ? 'Hide Video' : 'Show Video'}
        </div>
    );
};

export const ExplorerLevelButton = ({ info }) => {
    if (!info.isInfoMode()) {
        return null;
    }

    return (
        <Link target="_blank" className="exp-top-button" to={'/chart?type=author'}>
            See Author Info
        </Link>
    );
};

export const ExplorerToggleMenuButton = ({ info }) => {
    const cn = classNames('btn btn-outline-primary exp-top-button', {
        active: info.state.anchorSideMenu,
    });

    return (
        <div className={cn} onClick={() => info.setState({ anchorSideMenu: !info.state.anchorSideMenu })}>
            {info.state.anchorSideMenu ? 'Unpin Side Menu' : 'Pin Side Menu'}
        </div>
    );
};

export const ExplorerChartButton = ({ info }) => {
    const { filterText, filterType } = info.state;
    if (filterType) {
        return null;
    }

    let link;
    if (info.getMode() === MODE_AUTHOR) {
        link = `/chart?type=author&text=${encodeURIComponent(info.getTextFromQuery())}`;
    } else if (info.getMode() === MODE_TAG) {
        link = `/chart?type=tag&text=${encodeURIComponent(info.getTextFromQuery())}`;
    } else if (info.isInfoMode()) {
        link = `/chart?type=info&text=${encodeURIComponent(filterText || info.getTextFromQuery())}`;
    }

    if (!link) {
        return null;
    }

    return (
        <Link target="_blank" className="exp-top-button" to={link}>
            Show Chart
        </Link>
    );
};

export const ExplorerPregenerateButton = ({ info }) => {
    if (info.getMode() !== MODE_EXPLORER) {
        return null;
    }

    return (
        <div className="exp-top-button" onClick={() => info.askPregenerate({ isForce: true })}>
            Force Generate Thumbnail
        </div>
    );
};

export const ExplorerSortHeader = ({ info }) => {
    let sortOptions = ClientConstant.SORT_OPTIONS.slice();

    if (info.getMode() !== MODE_EXPLORER) {
        sortOptions.push(BY_FOLDER);
    }

    return (
        <div className="sort-header-container container">
            <SortHeader
                sortOptions={sortOptions}
                selected={info.state.sortOrder}
                isSortAsc={info.state.isSortAsc}
                onChange={info.onSortChange.bind(info)}
            />
        </div>
    );
};

export const ExplorerCheckboxPanel = ({ info }) => {
    const filters = [
        { id: 'FILTER_FIRST_TIME_AUTHOR', label: 'First Time Author' },
        { id: 'FILTER_HAS_MUSIC', label: 'Has Music' },
        { id: 'FILTER_HAS_VIDEO', label: 'Has Video' },
        { id: 'FILTER_IMG_FOLDER', label: 'Only Image Folder' },
    ];

    const checkboxes = filters.map((filter) => (
        <Checkbox key={filter.id} onChange={info.toggleFilter.bind(info, filter.id)} checked={info.isOn(filter.id)}>
            {filter.label}
        </Checkbox>
    ));

    return <div className="aji-checkbox-container container">{checkboxes}</div>;
};

export const ExplorerPagination = ({ info, filteredFiles, filteredVideos }) => {
    const totalNum = info.getTotalNumOfZipAndDir(filteredFiles, filteredVideos);
    const paginate = (index) => {
        info.handlePageChange(index);
    };

    return (
        <div className="pagination-container">
            <Pagination
                ref={(e) => {
                    info.pagination = e;
                }}
                totalNum={totalNum}
                current={info.state.pageIndex}
                perPageItem={info.getNumPerPage()}
                onChange={paginate}
            />
        </div>
    );
};

export const ExplorerSideMenu = ({ info, filteredFiles, filteredVideos }) => {
    const tags = _.pluck(info.tag, 'tag');
    const types = _.keys(info.typeCount);
    const tag2Freq = clientUtil.getFreq(tags);
    const type2Freq = clientUtil.getFreq(types);
    const { authorInfo } = info.state;

    const renderAuthor = () => {
        if (!authorInfo) {
            return null;
        }
        const { good_authors, total_count, top_fav } = authorInfo;

        return (
            <div className={'side-menu info container'}>
                <div className="row">
                    <div className="col-4">Good Authors {good_authors && good_authors.length}</div>
                    <div className="col-4">Total Books {total_count}</div>
                    <div className="col-4">top_fav {top_fav}</div>
                </div>
            </div>
        );
    };

    const renderZipOrVideo = () => {
        const zipCount = filteredFiles.length;
        const videoCount = filteredVideos.length;
        return (
            <div className={'side-menu info container'}>
                <div className="row">
                    <div className="col-6">Zip {zipCount}</div>
                    <div className="col-6">Video {videoCount}</div>
                </div>
            </div>
        );
    };

    const authorInfos = info.authorInfos.map((row) => {
        const { name, totalCount, goodCount, link } = row;
        return (
            <div className="side-menu-single-tag col-3" onClick={() => info.setFilterText(name)} key={name}>
                <a href={link} target="_blank" rel="noreferrer">
                    {name}
                    <span>({goodCount}/{totalCount})</span>
                </a>
            </div>
        );
    });

    tags.sort((a, b) => {
        return tag2Freq[b] - tag2Freq[a];
    });

    types.sort((a, b) => {
        return type2Freq[b] - type2Freq[a];
    });

    const tagInfos = tags.map((t) => {
        return (
            <div className="side-menu-single-tag col-3" onClick={() => info.setFilterText(t)} key={t}>
                {t}
                <span>({tag2Freq[t]})</span>
            </div>
        );
    });

    const typeInfos = types.map((t) => {
        return (
            <div className="side-menu-single-tag col-3 type-tag" onClick={() => info.setFilterType(t)} key={t}>
                {t}
                <span>({type2Freq[t]})</span>
            </div>
        );
    });

    let showAll;

    const { filterText, filterType } = info.state;

    if ((_.isString(filterText) && filterText) || (_.isString(filterType) && filterType)) {
        showAll = (
            <div
                className="side-menu-single-tag col-3"
                onClick={() => {
                    info.setFilterText('');
                    info.setFilterType('');
                }}
                key={'side-menu-single-tag-all'}
            >
                Back to All
            </div>
        );
    }

    const tagContainer = (
        <div className="exp-tag-container row">
            {showAll}
            {typeInfos}
            {tagInfos}
        </div>
    );

    const cn = classNames('side-menu container', {
        anchorSideMenu: info.state.anchorSideMenu,
    });

    return (
        <div className={cn}>
            <div className="side-menu-radio-title"> Special Filter </div>
            <div className="row info-row">
                <div className="col-3">{`filterText: ${filterText || '-'}`} </div>
                <div className="col-3">{`filterType: ${filterType || '-'}`} </div>
            </div>
            {renderZipOrVideo()}
            {renderAuthor()}
            {authorInfos && authorInfos.length > 0 && <div className="exp-tag-container row">{authorInfos}</div>}
            {tagContainer}
        </div>
    );
};

export const ExplorerDirectoryList = ({ info, dirs }) => {
    if (info.state.showFolderThumbnail) {
        const dirItems = dirs.map((item) => {
            const toUrl = clientUtil.getExplorerLink(item);
            const text = getBaseName(item);
            const thumbnailurl = clientUtil.getFileUrl(info.dirThumbnailMap[item]);
            const thumbnailCn = classNames('file-cell-thumbnail', 'as-folder-thumbnail');

            let imgDiv = (
                <LoadingImage
                    className={thumbnailCn}
                    title={item}
                    fileName={item}
                    url={thumbnailurl}
                    mode={'folder'}
                />
            );

            return (
                <div key={item} className={'col-sm-6 col-md-4 col-lg-3 file-out-cell'}>
                    <div className="file-cell">
                        <Link to={toUrl} key={item} className={'file-cell-inner'}>
                            <div className="file-cell-thumbnail-container">{imgDiv}</div>
                            <FileCellTitle text={text} filePath={item} />
                        </Link>
                    </div>
                </div>
            );
        });

        return (
            <div className="row">
                <ItemsContainer items={dirItems} />
            </div>
        );
    }

    const dirItems = dirs.map((item) => {
        const toUrl = clientUtil.getExplorerLink(item);
        const text = getBaseName(item);

        return (
            <Link to={toUrl} key={item} className={'col-6 col-md-4 col-lg-3 explorer-folder-name'}>
                <div className="file-icon">
                    <i className="far fa-folder" />
                </div>
                <div className="file-text" title={item}>
                    {text}
                </div>
            </Link>
        );
    });

    return <ItemsContainer items={dirItems} />;
};

export const ExplorerFileItems = ({ info, files, videos }) => {
    const zipfileItems = files.map((fp) => <ExplorerSingleZipItem key={fp} info={info} filePath={fp} />);

    return (
        <>
            {videos.length > 0 && <ItemsContainer items={info.getVideoItems(videos)} itemClassName="video" />}
            {info.musicFiles.length > 0 && info.imageFiles.length > 0 && (
                <SimpleFileListPanel musicFiles={info.musicFiles} imageFiles={info.imageFiles} info={info} />
            )}
            {info.musicFiles.length > 0 && <ItemsContainer items={info.getMusicItems(info.musicFiles)} itemClassName="music" />}
            {info.imageFiles.length > 0 && <ItemsContainer items={info.getImageItems(info.imageFiles)} itemClassName="image" />}
            <ItemsContainer items={zipfileItems} />
        </>
    );
};

export const getSortedFiles = ({ info, filteredFiles }) => {
    const { sortOrder, isSortAsc } = info.state;
    let files = filteredFiles;

    try {
        files = ExplorerUtil.sortFiles(info, files, sortOrder, isSortAsc);
    } catch (e) {
        console.error(e);
    }

    return files;
};

export const ExplorerFileList = ({ info, filteredFiles, filteredVideos }) => {
    const dirs = info.dirs;
    const videos = filteredVideos;
    let files = getSortedFiles({ info, filteredFiles });

    const isEmpty = [dirs, files, videos, info.musicFiles, info.imageFiles].every(_.isEmpty);
    if (isEmpty) {
        if (!info.res) {
            return <CenterSpinner text={info.getTextFromQuery()} />;
        }
        const str = info.getMode() === MODE_EXPLORER ? 'This folder is empty' : 'Empty Result';
        return (
            <div>
                <ExplorerPageRangeSlider info={info} />
                <ExplorerCheckboxPanel info={info} />
                <div className="one-book-nothing-available">
                    <div className="alert alert-secondary" role="alert">
                        {str}
                    </div>
                </div>
            </div>
        );
    }

    files = info.getFileInPage(files);
    const fileItems = <ExplorerFileItems info={info} files={files} videos={videos} />;

    return (
        <div className="explorer-main-panel container">
            <ExplorerDirectoryList info={info} dirs={dirs} />
            <ExplorerPagination info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
            <ExplorerPageRangeSlider info={info} />
            <ExplorerCheckboxPanel info={info} />
            {files.length > 0 && <ExplorerSortHeader info={info} />}
            {fileItems}
        </div>
    );
};

export const getLinkToEhentai = ({ info }) => {
    if (info.getMode() === MODE_AUTHOR) {
        const text = info.getTextFromQuery();
        return <LinkToEHentai searchable={text} text={`Search "${text}" in Exhentai`} />;
    }
    if (info.getMode() === MODE_TAG) {
        const text = info.getTextFromQuery();
        return <LinkToEHentai searchable={text} text={`Search "${text}" in Exhentai`} />;
    }
    if (info.getMode() === MODE_SEARCH) {
        const text = info.getSearchTextFromQuery();
        return <LinkToEHentai searchable={text} text={`Search "${text}" in Exhentai`} />;
    }
    return null;
};

export const ExplorerToolbar = ({ info, filteredFiles, filteredVideos }) => {
    if (info.getMode() === MODE_EXPLORER) {
        info.setFolderInLocalStorage(info.getTextFromQuery());
    }

    const isTagMode = info.getMode() === MODE_TAG;
    const isAuthorMode = info.getMode() === MODE_AUTHOR;
    const isSearchMode = info.getMode() === MODE_SEARCH;
    const isInfoMode = info.isInfoMode();

    const set = (val) => {
        info.setStateAndSetHash(val);
    };

    const getCheckbox = (label, key) => {
        return (
            <Checkbox key={key} onChange={() => set({ [key]: !info.state[key] })} checked={info.state[key]}>
                {label}
            </Checkbox>
        );
    };

    let path;
    let filePath;
    let showEH;

    if (info.getMode() === MODE_EXPLORER) {
        path = info.getPathFromQuery();
        filePath = path;
        showEH = false;
    } else {
        path = info.getTextFromQuery();
        filePath = info.context.getSearchFilePath(path);
        showEH = true;
    }

    const noScanAlert = info.context.noScanPaths?.includes(filePath) ? <NoScanAlertArea filePath={filePath} /> : null;

    const toolbarCn = classNames('exp-top-toolbar', {
        lack_info_mode: info.isLackInfoMode(),
    });

    const middlePanel = (
        <div className="container">
            <div className="row">
                {noScanAlert}
                {showEH && userConfig.explorer.show_exhentai_link !== false && getLinkToEhentai({ info })}
                <div className="col-md-6 col-lg-4">
                    <div className="location-title">
                        <Link target="_blank" to={clientUtil.getExplorerLink(clientUtil.getDir(path))}>
                            <i className="fas fa-level-up-alt"></i> Parent Folder
                        </Link>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="location-title">
                        <a href={clientUtil.getOneBookLink(path)} target="_blank" rel="noreferrer">
                            Open Book
                        </a>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="location-title">
                        <a href={clientUtil.getFileUrl(path)} target="_blank" rel="noreferrer">
                            Open Folder
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );

    const shouldShow = (flagKey) => info.state[flagKey] !== false;

    return (
        <div className={toolbarCn}>
            <Breadcrumb dir={path} />
            {middlePanel}
            <div className="container">
                <FileCountPanel filteredFiles={filteredFiles} filteredVideos={filteredVideos} info={info} />
                <div className="row explorer-top-bar-row">
                    {shouldShow('showFolderToggle') !== false && (
                        <div className="col-6 col-md-4">
                            <ExplorerToggleFolderThumbnailButton info={info} />
                        </div>
                    )}
                    <div className="col-6 col-md-4">
                        <ExplorerToggleThumbnailButton info={info} />
                    </div>
                    <div className="col-6 col-md-4">
                        <ExplorerToggleVideoButton info={info} />
                    </div>
                    {isInfoMode && shouldShow('showChartButton') && (
                        <div className="col-6 col-md-4">
                            <ExplorerChartButton info={info} />
                        </div>
                    )}
                    {isTagMode && info.renderFilterRow?.()}
                    {isAuthorMode && info.renderFilterRow?.()}
                    {isSearchMode && info.renderFilterRow?.()}
                    {info.getMode() === MODE_EXPLORER && isInfoMode && (
                        <>
                            {shouldShow('showLevelToggle') && (
                                <div className="col-6 col-md-4">
                                    <ExplorerLevelButton info={info} />
                                </div>
                            )}
                            {shouldShow('showForceGenerateButton') && (
                                <div className="col-6 col-md-4">
                                    <ExplorerPregenerateButton info={info} />
                                </div>
                            )}
                        </>
                    )}
                    <div className="col-6 col-md-4 ">
                        <ExplorerToggleMenuButton info={info} />
                    </div>
                    <div className="col-12 col-md-8">
                        <div className="row aji-checkbox-container">
                            {getCheckbox('Show chart button', 'showChartButton')}
                            {getCheckbox('Show guess toggle', 'showGuessToggle')}
                            {getCheckbox('Show history toggle', 'showHistoryToggle')}
                            {getCheckbox('Show level toggle', 'showLevelToggle')}
                            {getCheckbox('Show force generate button', 'showForceGenerateButton')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ExplorerLayout = ({ info, filteredFiles, filteredVideos }) => {
    const cn = classNames('explorer-container-out', info.getMode().replace(' ', '_'));

    return (
        <div className={cn}>
            {getLinkToEhentai({ info })}
            <ExplorerToolbar info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
            <ExplorerSideMenu info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
            <ExplorerFileList info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
            <ExplorerPagination info={info} filteredFiles={filteredFiles} filteredVideos={filteredVideos} />
        </div>
    );
};

