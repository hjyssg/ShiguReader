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
                            position:  this.props.popPosition
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

        if(typeof path === "string"){
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
                                position:  this.props.popPosition
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

    // copyToClipboard(path, mode){
    //     //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
    //     var textArea = document.createElement("textarea");
    //     if(mode === "delete"){
    //         textArea.value = "DEL /f \"" +  path + "\"";
    //     } else if(mode === "good"){
    //         textArea.value = "MOVE \"" +  path + "\"" + "  \"" + userConfig.good_folder +"\"";
    //     }else if(mode === "not_good"){
    //         textArea.value = "MOVE \"" +  path + "\"" + "   \"" + userConfig.not_good_folder +"\"";
    //     }

    //     document.body.appendChild(textArea);
    //     textArea.select();
    //     document.execCommand("Copy");
    //     textArea.remove();
    
    //     spop({
    //       template: 'Copied to Clipboard',
    //       position: 'bottom-right',
    //       autoclose: 3000
    //     });
    // }

    // renderDirectChange(){
    //     const { anchorEl } = this.state;
    //         return (<div>
    //                 <button onClick={this.handleClick} className="fas fa-arrow-right" title="directly move"/>
    //                 <Menu
    //                 id="simple-menu"
    //                 anchorEl={anchorEl}
    //                 open={Boolean(anchorEl)}
    //                 onClose={this.handleClose}
    //                 >
    //                     <MenuItem onClick={this.handleClose.bind(this, userConfig.good_folder)}>{"Move to " + userConfig.good_folder}</MenuItem>
    //                     <MenuItem onClick={this.handleClose.bind(this, userConfig.not_good_folder)}>{"Move to " + userConfig.not_good_folder}</MenuItem>
    //                 </Menu>
    //         </div>);
    // }

    getDropdownItems(){
        return userConfig.additional_folder.map((e, index) =>{
            return  (<DropdownItem key={index}>
                <div tabIndex="0"  className="" 
            title={"Move to " + e}
            onClick={this.handleClose.bind(this, e)}> {index+1} </div>
            </DropdownItem>);
        });
    }

    render(){
        const {file, className, header, isInOneBook} = this.props;
        const cn = classNames("file-change-tool-bar", className);

        let additional;
        if(isInOneBook){
            additional = this.getDropdownItems();
        }else{
            additional = <Dropdown>{this.getDropdownItems()}</Dropdown>;
        }

        return (
            <div className={cn} >
                {header && <span className="file-change-tool-bar-header">{header}</span>}
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
