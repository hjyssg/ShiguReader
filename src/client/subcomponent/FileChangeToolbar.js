import React, { Component, useState, useEffect } from 'react';
import '../style/Spinner.scss';
const userConfig = require('@config/user-config');
import PropTypes from 'prop-types';
var classNames = require('classnames');
import Swal from 'sweetalert2';
import Sender from '../Sender';
import '../style/FileChangeToolbar.scss';
const util = require("@common/util");
const clientUtil = require("../clientUtil");
const { getDir, getBaseName, getDownloadLink } = clientUtil;
import _ from 'underscore';
import { toast } from 'react-toastify';
import Modal from 'react-modal';
import ReactDOM from 'react-dom';
import FileNameDiv from './FileNameDiv';
import { Link } from 'react-router-dom';
import { GlobalContext } from '../globalContext'

function getExtraDiv(res) {
    let extraDiv;
    if (!res.isFailed()) {
        const newPath = res.json.dest;
        const toUrl = clientUtil.getOneBookLink(newPath);
        extraDiv = (
            <Link to={toUrl} className={"result-zip-path"} target="_blank">
                {newPath}
            </Link>);
    }
    return extraDiv;
}


function pop(file, res, postFix, extraDiv, callback) {
    const reason = res.json.reason;
    const isFailed = res.isFailed()
    const message = isFailed ? `fail to ${postFix} ${file}` : `${postFix} successfully`;
    const cn = isFailed ? "a-error" : "a-success";
    const badge = isFailed ? (<span className="badge badge-danger">Error</span>) :
        (<span className="badge badge-success">Success</span>)

    let divContent = (
        <div className="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div className="toast-header">
                {badge}
                <strong className="mr-auto">{postFix.toUpperCase()}</strong>
            </div>
            <div className="toast-body">
                <div>{getDir(file)} </div>
                <div>{getBaseName(file)} </div>
            </div>

            {isFailed && reason && (
                <div className="toast-body">
                    <div className="fail-reason-text">{reason}</div>
                </div>
            )}

            {extraDiv}
        </div>);

    const toastConfig = {
        position: "top-right",
        autoClose: (res.isFailed() || extraDiv) ? 10 * 1000 : 5 * 1000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: false
    };


    toast(divContent, toastConfig);

    if (!isFailed) {
        callback && callback(res)
    }
}

// modal can be replaced with singleton
// for better coding pattern
// hook cannot be used in loop
class MoveMenu extends Component {
    constructor() {
        super();
        this.state = {
            path: "",
            dirs: []
        };
    }

    componentDidMount() {
        Sender.postWithPromise("/api/homePagePath", {}).then(res => {
            if (res.isFailed()) {
                debugger
                return;
            } else {
                const { dirs, hdd_list, quickAccess } = res.json;
                this.setState({
                    dirs: hdd_list
                })
            }
        });
    }

    async onPathClick(path) {
        const res = await Sender.postWithPromise("/api/lsDir", { dir: path });
        if (res.isFailed()) {
            return;
        } else {
            const { dirs } = res.json;
            this.setState({
                dirs,
                path
            })
        }
    }

    render() {
        const { path, dirs } = this.state;

        const listItems = dirs.map(e => {
            return <div onClick={this.onPathClick.bind(this, e)}> {e} </div>
        })

        return <div>
            <div> {path} </div>
            {listItems}
        </div>
    }
}

export default class FileChangeToolbar extends Component {
    static defaultProps = {
        popPosition: "bottom-center"
    }

    constructor() {
        super();
        this.state = {
            showModal: false,
            mode: "default"
        };
    }

    handleOpenModal(event) {
        event && event.preventDefault();
        event && event.stopPropagation();
        this.setState({ showModal: true });
    }

    handleCloseModal(event) {
        event && event.preventDefault();
        event && event.stopPropagation();
        this.setState({ showModal: false });
    }

    handleOverwrite() {
        const { file } = this.props;
        Swal.fire({
            title: "Overwrite",
            text: `Replace the old file with the minified file?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.post("/api/overwrite", { filePath: file }, res => {
                    pop(file, res, "overwrite");
                });
            }
        });
    }

    handleMinifyZip() {
        const { file } = this.props;
        Swal.fire({
            title: "Minify Image",
            text: `Minify ${file}?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then(async (result) => {
            if (result.value === true) {
                let res = await Sender.postWithPromise('/api/isAbleToMinify', { filePath: file });
                if (res.isFailed()) {
                    pop(file, res, "Not able to minify");
                } else {
                    Sender.post("/api/minifyZip", { filePath: file }, res => {
                        pop(file, res, "added to the task queue");
                    });
                }
            }
        });
    }

    handleDelete() {
        const { file, isFolder } = this.props;
        Swal.fire({
            title: "Delete",
            text: `Delete ${file}?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                if (isFolder) {
                    //send different request
                    Sender.post("/api/deleteFolder", { src: file }, res => {
                        pop(file, res, "delete");
                    });

                } else {
                    Sender.post("/api/deleteFile", { src: file }, res => {
                        pop(file, res, "delete");
                    });
                }
            }
        });
    }


    handleZip() {
        const { file, isFolder } = this.props;
        Swal.fire({
            title: "Zip",
            text: `Zip ${file}?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true && isFolder) {
                Sender.post("/api/zipFolder", { src: file }, res => {
                    let extraDiv = getExtraDiv(res);
                    pop(file, res, "zip folder", extraDiv);
                });
            }
        });
    }


    handleMove = (path) => {
        const { file, onNewPath } = this.props;
        if (_.isString(path)) {
            Swal.fire({
                html: 'Move this file to <span class="path-highlight">' + path + "</span>",
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No'
            }).then((result) => {
                if (result.value === true) {
                    Sender.post("/api/moveFile", { src: this.props.file, dest: path }, res => {
                        let extraDiv = getExtraDiv(res);
                        pop(file, res, "move", extraDiv, onNewPath);
                    });
                }
            });
        }
    };

    handleRename(type) {
        let { file, onNewPath } = this.props;

        const fileName = clientUtil.getBaseName(file);
        const dirPath = clientUtil.getDir(file);

        const sep = this.context.file_path_sep || "\\";
        let defaultText;
        if (type === "move") {
            //get its dir path
            defaultText = dirPath;
        } else if (type === "rename") {
            //get its file name
            defaultText = fileName;
        }

        let dest = prompt(type, defaultText);
        if (!dest) {
            return;
        }

        if (type === "move") {
            //get its dir path
            this.handleMove(dest);
            return;
        } else if (type === "rename") {
            //get its file name
            dest = dirPath + sep + dest;
            if (dest) {
                Swal.fire({
                    html: 'Rename this file to <span class="path-highlight">' + dest + "</span>",
                    showCancelButton: true,
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No'
                }).then((result) => {
                    if (result.value === true) {
                        Sender.post("/api/renameFile", { src: file, dest }, res => {
                            let extraDiv = getExtraDiv(res);
                            pop(file, res, "rename", extraDiv, onNewPath);
                        });
                    }
                });
            }
        }
    }

    getDropdownItems() {
        let arr = this.context.additional_folder || [];
        arr = arr.filter(e => {
            if (e.includes(userConfig.img_convert_cache) || e.includes(userConfig.zip_output_cache)) {
                return false;
            }
            return true;
        })

        return arr.map((e, index) => {
            const onClick = () => {
                this.handleCloseModal();
                this.handleMove(e)
            }

            const dd = (<div tabIndex="0"
                className="modal-list-item" key={index}
                title={"Move to " + e}
                onClick={onClick}>
                {e}
            </div>);
            return dd;
        });
    }

    renderDownloadLink() {
        return (<a className="fa fa-fw fa-download" href={clientUtil.getDownloadLink(this.props.file)} />);
    }

    renderMinifyZipButton() {
        const { has_magick } = this.context;
        if (!has_magick) {
            return;
        }

        const { file, className, header, hasMusic, bigFont } = this.props;
        // const showMinifyZip = util.isCompress(file);
        if (!this.isInMinifiedFolder()) {
            return (<div tabIndex="0" className="fas fa-hand-scissors" title="minify img"
                onClick={this.handleMinifyZip.bind(this)}></div>)
        }
    }

    isInMinifiedFolder() {
        const { file } = this.props;
        return file && file.includes(userConfig.img_convert_cache);
    }

    renderOverwriteButton() {
        const { file, hasMusic } = this.props;
        const showMinifyZip = util.isCompress(file) && !hasMusic;
        if (showMinifyZip && this.isInMinifiedFolder()) {
            return (<div tabIndex="0" className="fas fa-cut" title="overwrite the original file"
                onClick={this.handleOverwrite.bind(this)}></div>)
        }
    }

    renderRenameButton() {
        return (<div tabIndex="0" className="fas fa-pen raname-button" title="rename file"
            onClick={this.handleRename.bind(this, "rename")}></div>)

    }

    renderMoveButton() {
        // return (<div tabIndex="0" className="fas fa-pen move-button" title="move file"
        //     onClick={this.handleRename.bind(this, "move")}></div>)

        return (<div tabIndex="0" className="fas fa-pen move-button" title="move file"
            onClick={() => this.switchMode("move_menu")}></div>)
    }

    switchMode(mode) {
        this.setState({
            mode
        })
    }

    renderDeleteButton() {
        return (
            <div tabIndex="0" className="fas fa-trash-alt"
                title="Del"
                onClick={this.handleDelete.bind(this)}></div>
        );
    }

    renderZipButton() {
        return (
            <div tabIndex="0" className="fas fa-file-archive"
                title="Zip Folder"
                onClick={this.handleZip.bind(this)}></div>
        );
    }

    isImgFolder() {
        return !util.isCompress(this.props.file)
    }



    renderMoveModal() {
        const filePath = this.props.file;
        const { mode } = this.state;

        let explorerLink;
        if (this.isImgFolder()) {
            const toUrl = clientUtil.getExplorerLink(filePath);
            explorerLink = (<div className="section with-bottom-margin">
                <Link target="_blank" to={toUrl} >open in explorer</Link>
            </div>);
        }

        let content = (<React.Fragment>
            <div className="section with-bottom-margin">
                <div className="file-dir-name">{getDir(filePath)} </div>
                <FileNameDiv className="file-name-title" filename={getBaseName(filePath)} />
            </div>

            <div className="section with-bottom-margin">
                <div className="title"> Move To: </div>
                {this.getDropdownItems()}
            </div>

            {explorerLink}

            <div className="section with-bottom-margin">
                <div className="title">Move: </div>
                {this.renderMoveButton()}
            </div>

            <div className="section">
                <div className="title">Rename: </div>
                {this.renderRenameButton()}
            </div></React.Fragment>);


        if(mode === "move_menu"){
            content = (<div> 
                <div onClick={()=>this.switchMode("default")}> back </div>
                <MoveMenu />
                
            </div>)
        }

        return (
            <Modal
                isOpen={this.state.showModal}
                ariaHideApp={false}
                contentLabel="Move to which path"
                className="file-change-toolbar-move-modal"
                onRequestClose={this.handleCloseModal.bind(this)}
            >
                { content  }
            </Modal>
        );
    }

    renderModalButton() {
        return (
            <div tabIndex="0" className="fas fa-bars"
                title="open move-path windows"
                onClick={this.handleOpenModal.bind(this)}>
            </div>
        );
    }

    renderMoveGoodBadButton() {
        const { good_folder, not_good_folder } = this.context;

        return (
            <React.Fragment>
                {good_folder &&
                    <div tabIndex="0" className="fas fa-check"
                        title={"Move to " + good_folder}
                        onClick={this.handleMove.bind(this, good_folder)}></div>}
                {not_good_folder &&
                    <div tabIndex="0" className="fas fa-times"
                        title={"Move to " + not_good_folder}
                        onClick={this.handleMove.bind(this, not_good_folder)}></div>}
            </React.Fragment>
        )
    }

    render() {
        const { file, className, header, hasMusic, bigFont, isFolder } = this.props;
        const cn = classNames("file-change-tool-bar", className, {
            bigFont: bigFont || clientUtil.isMobile(),
        });



        const { etc_config } = this.context;
        if (!clientUtil.isAuthorized(etc_config)) {
            return <div className={cn} > {this.renderDownloadLink()}</div>;
        }

        let secondRow;

        if (isFolder) {
            secondRow = (
                <div className="tool-bar-row second">
                    {this.renderMinifyZipButton()}
                    {this.renderZipButton()}
                    {this.renderModalButton()}
                </div>
            );
        } else {
            secondRow = (
                <div className="tool-bar-row second">
                    {this.renderDownloadLink()}
                    {this.renderMinifyZipButton()}
                    {this.renderOverwriteButton()}
                    {this.renderModalButton()}
                </div>
            );
        }

        return (
            <div className={cn} >
                {header && <span className="file-change-tool-bar-header">{header}</span>}
                <div className="tool-bar-row">
                    {this.renderMoveGoodBadButton()}
                    {this.renderDeleteButton()}
                </div>
                {secondRow}
                {this.renderMoveModal()}
            </div>
        )

    }
}

FileChangeToolbar.contextType = GlobalContext;

FileChangeToolbar.propTypes = {
    file: PropTypes.string,
    header: PropTypes.any,
    popPosition: PropTypes.string
};
