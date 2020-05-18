import React, { Component } from 'react';
import '../style/Spinner.scss';
const spop  = require("./spop");
const userConfig = require('../../user-config');
import PropTypes from 'prop-types';
var classNames = require('classnames');
import Swal from 'sweetalert2';
import Sender from '../Sender';
import '../style/FileChangeToolbar.scss';
import Dropdown from "./Dropdown";
import DropdownItem from "./DropdownItem";
const util = require("../../util");
const clientUtil = require("../clientUtil");
const { getDir, getBaseName } = clientUtil;
import _ from 'underscore';


export default class FileChangeToolbar extends Component {
    static defaultProps = {
        popPosition: "bottom-center"
    }

    state = {
        anchorEl: null,
    };
    
    handleClick = event => {
        this.setState({ anchorEl: event.currentTarget });
    }

    handleMinifyZip(){
        const { file } = this.props;
        Swal.fire({
            title: "Minify Zip",
            text: 'Do you want to minify the file?' ,
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
        this.setState({ anchorEl: null });
        Swal.fire({
            title: "Delete",
            text: 'Do you want to delete this file?' ,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.simplePost("/api/deleteFile", {src: this.props.file}, res => {
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
        this.setState({ anchorEl: null });

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

    getDropdownItems(){
        const {showAllButtons} = this.props;
        return userConfig.additional_folder.map((e, index) =>{
            const dd = (<div tabIndex="0"  className="letter-button"  key={index}
            title={"Move to " + e}
            onClick={this.handleClose.bind(this, e)}> {getBaseName(e)[0]} </div>);

            if(showAllButtons){
                return dd;
            }else{
                return  (<DropdownItem key={index}>
                    {dd}
                </DropdownItem>);
            }
        });
    }

    render(){
        const {file, className, header, showAllButtons} = this.props;
        const cn = classNames("file-change-tool-bar", className);

        if(!clientUtil.isAuthorized()){
            return  <div className={cn} ></div>;
        }

        let additional;
        if(showAllButtons){
            additional = this.getDropdownItems();
        }else{
            additional = <Dropdown>{this.getDropdownItems()}</Dropdown>;
        }

        return (
            <div className={cn} >
                {header && <span className="file-change-tool-bar-header">{header}</span>}
                <div tabIndex="0" className="fas fa-hand-scissors"
                                title="minify zip"
                                onClick={this.handleMinifyZip.bind(this)}></div>
                <div tabIndex="0" className="fas fa-trash-alt"
                                title="Copy Del"
                                onClick={this.handleDelete.bind(this)}></div>
                <div tabIndex="0"  className="fas fa-check"
                                title={"Move to " + userConfig.good_folder}
                                onClick={this.handleClose.bind(this, userConfig.good_folder)}></div>
                <div tabIndex="0"  className="fas fa-times"
                                title={"Move to " + userConfig.not_good_folder}
                                onClick={this.handleClose.bind(this, userConfig.not_good_folder)}></div>
                {additional}
            </div>
        )
     }
}

FileChangeToolbar.propTypes = {
    file: PropTypes.string,
    header: PropTypes.any,
    popPosition: PropTypes.string
};
