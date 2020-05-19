import React, { Component } from 'react';
import '../style/Spinner.scss';
const spop  = require("./spop");
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


export default class FileChangeToolbar extends Component {
    static defaultProps = {
        popPosition: "bottom-center"
    }

    handleMinifyZip(){
        const { file } = this.props;
        Swal.fire({
            title: "Minify Zip",
            text: `Do you want to minify ${file}?`,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.simplePost("/api/minifyZip", {filePath: file}, res => {
                    if (!res.failed) {
                        spop({
                            style: "info",
                            template: `${file} is added to the task queue`,
                            position:  this.props.popPosition,
                            autoclose: 3000

                        });
                    }else{
                        spop({
                            style: "error",
                            template: `Not able to minify ${file}`,
                            position:  this.props.popPosition,
                            autoclose: 60000
                        });
                    }
                });
            } 
        });
    }

    handleDelete(){
        const { file } = this.props;
        Swal.fire({
            title: "Delete",
            text: `Do you want to delete ${file}?` ,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.simplePost("/api/deleteFile", {src: file}, res => {
                    if (!res.failed) {
                        spop({
                            style: "success",
                            template: 'Deleted ' + this.props.file,
                            position:  this.props.popPosition,
                            autoclose: 3000

                        });
                    }else{
                        spop({
                            style: "error",
                            template: 'Failed to delete',
                            position:  this.props.popPosition,
                            autoclose: 60000
                        });
                    }
                });
            } 
        });
    }

    handleClose = (path) => {

        if(_.isString(path)){
            Swal.fire({
                html: 'Do you want to move this file to <span class="path-highlight">'+  path +"</span>",
                showCancelButton: true,
                confirmButtonText: 'Yes',
                cancelButtonText: 'No'
            }).then((result) => {
                if (result.value === true) {
                    const template = "Moved " + this.props.file +  "  to  " + path;

                    Sender.simplePost("/api/moveFile", {src: this.props.file, dest: path}, res => {
                        if (!res.failed) {
                            spop({
                                style: "success",
                                template: template, // ['Moved', this.props.file, "to", path, 'Successfully'].join(" "),
                                position:  this.props.popPosition,
                                autoclose: 3000
                            });
                        }else{
                            spop({
                                style: "error",
                                template: 'Failed to Move',
                                position:  this.props.popPosition,
                                autoclose: 3000
                            });
                        }
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
            onClick={this.handleClose.bind(this, e)}> {getBaseName(e).slice(0, 2)} </div>);

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
        if(showMinifyZip){
            return ( <div tabIndex="0" className="fas fa-hand-scissors"  title="minify zip"
                      onClick={this.handleMinifyZip.bind(this)}></div>)
        }
    }

    render(){
        const {file, className, header, showAllButtons, hasMusic, bigFont} = this.props;
        const cn = classNames("file-change-tool-bar", className, {
            bigFont: bigFont
        });

        if(!clientUtil.isAuthorized()){
            return  <div className={cn} ></div>;
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
                    <div tabIndex="0" className="fas fa-trash-alt"
                                    title="Copy Del"
                                    onClick={this.handleDelete.bind(this)}></div>
                    <div tabIndex="0"  className="fas fa-check"
                                    title={"Move to " + userConfig.good_folder}
                                    onClick={this.handleClose.bind(this, userConfig.good_folder)}></div>
                    <div tabIndex="0"  className="fas fa-times"
                                    title={"Move to " + userConfig.not_good_folder}
                                    onClick={this.handleClose.bind(this, userConfig.not_good_folder)}></div>
                </div>
                <div className="tool-bar-row second">
                    {this.renderDownloadLink()}
                    {this.renderMinifyZipButton()}
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
