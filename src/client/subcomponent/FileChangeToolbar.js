import React, { Component } from 'react';
import '../style/Spinner.scss';
const userConfig = require('@config/user-config');
import PropTypes from 'prop-types';
var classNames = require('classnames');
import Swal from 'sweetalert2';
import Sender from '../Sender';
import '../style/FileChangeToolbar.scss';
import Dropdown from "./Dropdown";
import DropdownItem from "./DropdownItem";
const util = require("@common/util");
const clientUtil = require("../clientUtil");
const { getDir, getBaseName, getDownloadLink } = clientUtil;
import _ from 'underscore';
import { toast } from 'react-toastify';

const toastConfig = {
    position: "top-right",
    autoClose: 5*1000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: false
};

function pop(file, res, postFix){
    const isFailed = res.failed
    const message = isFailed? `fail to ${postFix} ${file}` : `${postFix} successfully`;
    const cn = isFailed? "a-error": "a-success";
    const badge = isFailed? (<span className="badge badge-danger">Error</span>) :
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
    </div>);
    
    toast(divContent, toastConfig)

}

export default class FileChangeToolbar extends Component {
    static defaultProps = {
        popPosition: "bottom-center"
    }


    handleOverwrite(){
        const { file } = this.props;
        Swal.fire({
            title: "Overwrite",
            text: `Overwrite overwrite the old file with the minified file?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.simplePost("/api/overwrite", {filePath: file}, res => {
                    pop(file, res, "overwrite");
                });
            } 
        });
    }

    handleMinifyZip(){
        const { file } = this.props;
        Swal.fire({
            title: "Minify Zip",
            text: `Minify ${file}?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.simplePost("/api/minifyZip", {filePath: file}, res => {
                    pop(file, res, "added to the task queue");
                });
            } 
        });
    }

    handleDelete(){
        const { file, isFolder } = this.props;
        Swal.fire({
            title: "Delete",
            text: `Delete ${file}?` ,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                if(isFolder){
                    //send different request
                    Sender.simplePost("/api/deleteFolder", {src: file}, res => {
                        pop(file, res, "delete");
                    });

                }else{
                    Sender.simplePost("/api/deleteFile", {src: file}, res => {
                        pop(file, res, "delete");
                    });
                }
            } 
        });
    }

    handleMove = (path) => {
        const { file } = this.props;
        if(_.isString(path)){
            Swal.fire({
                html: 'Move this file to <span class="path-highlight">'+  path +"</span>",
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No'
            }).then((result) => {
                if (result.value === true) {
                    Sender.simplePost("/api/moveFile", {src: this.props.file, dest: path}, res => {
                        pop(file, res, "move");
                    });
                } 
            });
        }
    };

    isShowAllButtons(){
        const { additional_folder } = userConfig;
        return this.props.showAllButtons || additional_folder.length <= 3;
    }

    getDropdownItems(){
        const { additional_folder } = userConfig;
        return additional_folder.map((e, index) =>{
            const dd = (<div tabIndex="0"  className="letter-button"  key={index}
            title={"Move to " + e}
            onClick={this.handleMove.bind(this, e)}> {getBaseName(e).slice(0, 2)} </div>);

            if(this.isShowAllButtons()){
                return dd;
            }else{
                return  (<DropdownItem key={index}>
                    {dd}
                </DropdownItem>);
            }
        });
    }

    renderDownloadLink(){
        return (<a className="fa fa-fw fa-download" href={clientUtil.getDownloadLink(this.props.file)} />);
    }

    renderMinifyZipButton(){
        const {file, className, header, showAllButtons, hasMusic, bigFont} = this.props;
        const showMinifyZip = util.isCompress(file) && !hasMusic;
        if(showMinifyZip && !this.isInMinifiedFolder()){
            return ( <div tabIndex="0" className="fas fa-hand-scissors"  title="minify zip"
                      onClick={this.handleMinifyZip.bind(this)}></div>)
        }
    }

    isInMinifiedFolder(){
        const { file } = this.props;
        return file && file.includes(userConfig.img_convert_cache);
    }

    renderOverwriteButton(){
        const {file, hasMusic} = this.props;
        const showMinifyZip = util.isCompress(file) && !hasMusic;
        if(showMinifyZip && this.isInMinifiedFolder()){
            return ( <div tabIndex="0" className="fas fa-cut"  title="overwrite the original file"
                      onClick={this.handleOverwrite.bind(this)}></div>)
        }
    }

    renderRenameButton(){
        return ( <div tabIndex="0" className="fas fa-pen"  title="rename file"
                      onClick={this.handleRename.bind(this)}></div>)
        
    }

    handleRename(){
        const {file} = this.props;
        let dest = prompt("Raname or Move", file);
        if(dest && file !== dest){
            Swal.fire({
                html: 'Rename this file to <span class="path-highlight">'+ dest +"</span>",
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No'
            }).then((result) => {
                if (result.value === true) {
                    Sender.simplePost("/api/renameFile", {src: file, dest}, res => {
                        pop(file, res, "rename");
                    });
                } 
            });
        }
    }

    renderDeleteButton(){
        return (
            <div tabIndex="0" className="fas fa-trash-alt"
            title="Del"
            onClick={this.handleDelete.bind(this)}></div>
        );
    }

    render(){
        const {file, className, header, showAllButtons, hasMusic, bigFont, isFolder} = this.props;
        const cn = classNames("file-change-tool-bar", className, {
            bigFont: bigFont
        });

        if(isFolder){
            //todo: compress to zip button
            return (
            <div className={cn} >
            {header && <span className="file-change-tool-bar-header">{header}</span>}
            <div className="tool-bar-row">
                {this.renderDeleteButton()}
            </div>
            </div>);
        }

        if(!clientUtil.isAuthorized()){
            return  <div className={cn} > {this.renderDownloadLink()}</div>;
        }

        let additional;
        if(this.isShowAllButtons()){
            additional = this.getDropdownItems();
        }else{
            additional = <Dropdown>{this.getDropdownItems()}</Dropdown>;
        }

        return (
            <div className={cn} >
                {header && <span className="file-change-tool-bar-header">{header}</span>}
                <div className="tool-bar-row">
                    <div tabIndex="0"  className="fas fa-check"
                                    title={"Move to " + userConfig.good_folder}
                                    onClick={this.handleMove.bind(this, userConfig.good_folder)}></div>
                    <div tabIndex="0"  className="fas fa-times"
                                    title={"Move to " + userConfig.not_good_folder}
                                    onClick={this.handleMove.bind(this, userConfig.not_good_folder)}></div>
                    {this.renderDeleteButton()}
                </div>
                <div className="tool-bar-row second">
                    {this.renderDownloadLink()}
                    {this.renderMinifyZipButton()}
                    {this.renderOverwriteButton()}
                    {this.renderRenameButton()}
                    {additional}
                </div>
            </div>
        )
     }
}

FileChangeToolbar.propTypes = {
    file: PropTypes.string,
    header: PropTypes.any,
    popPosition: PropTypes.string
};
