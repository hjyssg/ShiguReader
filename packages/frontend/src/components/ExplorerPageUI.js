// @flow
import React, { Component } from 'react';
import _ from "underscore";
// import './style/Explorer.scss';
import LoadingImage from './LoadingImage';
import { addFileWatch } from '@api/folder';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, ListGroup, Row } from 'react-bootstrap';
import Panel from './common/Panel';

const userConfig = require('@config/user-config');
import ErrorPage from '@pages/ErrorPage';
import FileChangeToolbar from './common/FileChangeToolbar';
import CenterSpinner from './common/CenterSpinner';
const util = require("@common/util");
const queryString = require('query-string');
import Pagination from './common/Pagination';
import SortHeader from './common/SortHeader';
import Breadcrumb from './common/Breadcrumb';
import FileCellTitle from './common/FileCellTitle';
import ClickAndCopyDiv from './common/ClickAndCopyDiv';
import Checkbox from './common/Checkbox';
import ThumbnailPopup from './common/ThumbnailPopup';
import { getFileUrl } from '@utils/clientUtil';
const nameParser = require('@name-parser');
const classNames = require('classnames');
const Constant = require("@common/constant");
const clientUtil = require("@utils/clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil;
const { isVideo, isCompress, isImage, isMusic } = util;
// const sortUtil = require("../common/sortUtil");
const AdminUtil = require("@utils/AdminUtil");
import Swal from 'sweetalert2';
import RangeSlider from 'react-range-slider-input';
import 'react-range-slider-input/dist/style.css';

// import { GlobalContext } from './globalContext'


const ClientConstant = require("@utils/ClientConstant");
// const { BY_FILE_NUMBER,
//     BY_TIME,
//     BY_MTIME,
//     BY_LAST_READ_TIME,
//     BY_READ_COUNT,
//     BY_FILE_SIZE,
//     BY_AVG_PAGE_SIZE,
//     BY_PAGE_NUMBER,
//     BY_FILENAME,
//     BY_GOOD_SCORE,
//     BY_FOLDER,
//     BY_RANDOM } = ClientConstant;

// const { MODE_TAG,
//     MODE_AUTHOR,
//     MODE_SEARCH,
//     MODE_EXPLORER } = Constant;

// const GOOD_STANDARD = 2;

// const FILTER_GOOD_AUTHOR = "FILTER_GOOD_AUTHOR";
// const FILTER_OVERSIZE = "FILTER_OVERSIZE";
// const FILTER_FIRST_TIME_AUTHOR = "FILTER_FIRST_TIME_AUTHOR";
// const FILTER_HAS_MUSIC = "FILTER_HAS_MUSIC";
// const FILTER_HAS_VIDEO = "FILTER_HAS_VIDEO";
// const FILTER_IMG_FOLDER = "FILTER_IMG_FOLDER";


export const NoScanAlertArea = ({ filePath }) => {
    // const [minifyZipQue, setMinifyZipQue] = useState([]);

    const askSendScan = () => {
        Swal.fire({
            title: "Scan Folder",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                addFileWatch(filePath);
            }
        });
    }

    return (
        <Alert variant="warning" className="mb-3 shadow-sm">
            <div className="fw-semibold">{`${filePath} is not included in config-path`}</div>
            <div className="small mb-3">{`It's usable but still missing important features like tags and search.`}</div>
            <div className="d-flex justify-content-end">
                <Button variant="outline-warning" size="sm" onClick={askSendScan}>
                    <i className="fas fa-sync-alt me-2" aria-hidden="true"></i>
                    Scan Folder
                </Button>
            </div>
        </Alert>)
}


export const FileCountPanel = ({ filteredFiles, filteredVideos, info }) => {
    const totalZipSize = info.countAllFileSize(filteredFiles);
    const totalVideoSize = info.countAllFileSize(filteredVideos);
    const totalSize = totalZipSize + totalVideoSize;
    const title = `${filesizeUitl(totalZipSize)} zips and ${filesizeUitl(totalVideoSize)} videos`
    const totalPageNum = info.countAllFilePageNum(filteredFiles);
    const fileCountItems = [
        {
            key: 'zip',
            icon: 'fas fa-archive',
            label: 'Zip',
            value: filteredFiles.length,
        },
        {
            key: 'page',
            icon: 'fas fa-file-alt',
            label: 'Page',
            value: totalPageNum,
        },
        {
            key: 'video',
            icon: 'fas fa-video',
            label: 'Video',
            value: filteredVideos.length,
        },
        {
            key: 'music',
            icon: 'fas fa-music',
            label: 'Music',
            value: info.musicFiles.length,
        },
        {
            key: 'image',
            icon: 'fas fa-images',
            label: 'Image',
            value: info.imageFiles.length,
        },
        {
            key: 'folder',
            icon: 'fas fa-folder-open',
            label: 'Folder',
            value: info.dirs.length,
        },
        {
            key: 'total',
            icon: 'fas fa-database',
            label: 'Total',
            value: filesizeUitl(totalSize),
            title,
        },
    ];
    return (
        <Panel title="Summary" bodyClassName="p-3">
            <Row xs={1} sm={2} lg={3} className="g-3">
                {fileCountItems.map(({ key, icon, label, value, title: itemTitle }) => (
                    <Col key={key}>
                        <Card bg="light" text="dark" className="h-100 border-0 shadow-sm" title={itemTitle}>
                            <Card.Body className="d-flex align-items-center gap-3">
                                <div className="display-6 mb-0 text-primary">
                                    <i className={icon} aria-hidden="true"></i>
                                </div>
                                <div>
                                    <div className="fw-semibold text-uppercase small text-muted">{label}</div>
                                    <div className="fs-5 fw-bold">{value}</div>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Panel>
    );
}

export const LinkToEHentai = ({ searchable, text }) => {
    const link = "https://exhentai.org/?f_search=" + searchable;
    const title = "Search '" + searchable + "' in Exhentai";

    return (<center className={"location-title"}>
        <a className="explorer-external-link" target="_blank" href={link} title={title}>{text} </a>
        <ClickAndCopyDiv text={searchable} />
    </center>);
}


export const SimpleFileListPanel = ({ musicFiles, imageFiles, info }) => {
    const sections = [
        {
            key: 'music',
            title: 'Music',
            icon: <i className="fas fa-volume-up" aria-hidden="true"></i>,
            items: musicFiles,
            toUrl: item => clientUtil.getBookReadLink(getDir(item)),
        },
        {
            key: 'image',
            title: 'Images',
            icon: <i className="fas fa-images" aria-hidden="true"></i>,
            items: imageFiles,
            toUrl: item => clientUtil.getBookReadLink(getDir(item)),
        },
    ].filter(section => Array.isArray(section.items) && section.items.length);

    if (!sections.length) {
        return null;
    }

    return (
        <Panel title="Media" bodyClassName="p-0">
            {sections.map(({ key, title, icon, items, toUrl }) => (
                <div key={key}>
                    <div className="px-3 pt-3 pb-2 text-uppercase small text-muted fw-semibold">{title}</div>
                    <ListGroup variant="flush" className="rounded-0">
                        {items.map((item) => {
                            const text = getBaseName(item);
                            return (
                                <ListGroup.Item
                                    key={item}
                                    as={Link}
                                    to={toUrl(item)}
                                    target="_blank"
                                    className="d-flex align-items-center gap-3 explorer-one-line-list-item text-reset text-decoration-none"
                                    action
                                    title={info.getTooltipStr(item)}
                                >
                                    <span className="text-primary fs-5 d-flex align-items-center" aria-hidden="true">{icon}</span>
                                    <span className="flex-grow-1 explorer-one-line-list-item-text">{text}</span>
                                </ListGroup.Item>
                            );
                        })}
                    </ListGroup>
                </div>
            ))}
        </Panel>
    );
}

export const SingleZipItem = ({ filePath, info }) => {
    const fp = filePath;
    const text = getBaseName(fp);
    const toUrl = clientUtil.getBookReadLink(fp);

    let thumbnailurl = info.getThumbnailUrl(fp);


    const fileSize = info.hasFileSize(fp) && info.getFileSize(fp);
    const fileSizeStr = fileSize && filesizeUitl(fileSize);

    const avgSize = info.getPageAvgSize(fp);
    const avgSizeStr = avgSize > 0 && filesizeUitl(avgSize);

    const musicNum = info.getMusicNum(fp);
    const isImgFolder = info.isImgFolder(fp);
    const hasMusic = musicNum > 0;
    const pageNum = info.getPageNum(fp);

    const thumbnailCn = classNames("file-cell-thumbnail", {
        "as-folder-thumbnail": isImgFolder
    });

    let imgDiv = (
    <LoadingImage
        mode={"zip"}
        className={thumbnailCn}
        title={info.getTooltipStr(fp)}
        fileName={fp}
        url={thumbnailurl}
        musicNum={musicNum}
    />);

    if (isImgFolder) {
        imgDiv = (<div className="folder-effect"> {imgDiv} </div>)
    }

    return (
        <Col key={fp} xs={12} sm={6} md={4} lg={3} className="d-flex">
            <Card className="flex-fill h-100 shadow-sm border-0">
                <Card.Body className="d-flex flex-column gap-3">
                    <Link target="_blank" to={toUrl} className="text-reset text-decoration-none">
                        <div className="mb-2">
                            <FileCellTitle str={text} />
                        </div>
                        <div className="rounded border bg-light overflow-hidden">
                            {imgDiv}
                        </div>
                    </Link>
                    <div className="d-flex flex-wrap gap-2 small text-muted">
                        {fileSizeStr && <Badge bg="secondary" title="File Size">{fileSizeStr}</Badge>}
                        <Badge bg="light" text="dark">{`${pageNum} pages`}</Badge>
                        {hasMusic && <Badge bg="info" text="dark">{`${musicNum} songs`}</Badge>}
                        {avgSizeStr && <Badge bg="secondary" title="Average Image Size">{avgSizeStr}</Badge>}
                    </div>
                </Card.Body>
                <Card.Footer className="bg-white border-0 pt-0">
                    <FileChangeToolbar
                        isFolder={isImgFolder}
                        hasMusic={hasMusic}
                        className="explorer-file-change-toolbar d-flex justify-content-between"
                        file={fp}
                    />
                </Card.Footer>
            </Card>
        </Col>
    );
}


export const FileGroupZipPanel = ({
    files,
    isSortAsc,
    info
}) => {
    const byDir = _.groupBy(files, getDir);
    let fDirs = _.keys(byDir);
    // 文件夹根据所拥有文件件的时间来排序
    fDirs = _.sortBy(fDirs, dirPath => {
        const files = byDir[dirPath];
        const times = files.map(fp => info.getMtime(fp)).filter(e => !!e);
        const avgTime = util.getAverage(times);
        return avgTime || 0;
    });

    if (isSortAsc) {
        fDirs.reverse();
    }

    const panels = fDirs.map((dirPath, ii) => {
        const folderGroup = byDir[dirPath];
        const extraDiv = (<div className="extra-div" >{`Zip: ${folderGroup.length}`} </div>);
        const zipGroup = folderGroup.map(fp => info.renderSingleZipItem(fp));
        const content = info.state.noThumbnail
            ? (<ListGroup variant="flush">{zipGroup}</ListGroup>)
            : (<Row className="g-3">{zipGroup}</Row>);

        return (
            <Panel
                key={dirPath}
                className={classNames({ 'mt-3': ii > 0 })}
                bodyClassName="p-3"
                title={<Breadcrumb
                    sep={info.context.file_path_sep}
                    server_os={info.context.server_os}
                    path={dirPath}
                    className="m-0"
                    extraDiv={extraDiv}
                />}
            >
                {content}
            </Panel>
        );
    });

    return <div className="d-flex flex-column gap-3">{panels}</div>;
}

//-----------------------------------------


function parse(str) {
    return nameParser.parse(getBaseName(str));
}

function _parseInt(val) {
    if (_.isNumber(val)) {
        return val;
    } else {
        return parseInt(val);
    }
}

