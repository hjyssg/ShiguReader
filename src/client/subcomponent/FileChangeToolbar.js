import React, { Component } from 'react';
import '../style/Spinner.scss';
const spop  = require("./spop");
const userConfig = require('../../user-config');
import PropTypes from 'prop-types';
var classNames = require('classnames');
// import Menu from '@material-ui/core/Menu';
// import MenuItem from '@material-ui/core/MenuItem';
import Swal from 'sweetalert2';
import Sender from '../Sender';

export default class FileChangeToolbar extends Component {
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
                            template: 'Delete ' + this.props.file + ' successfully',
                            position: 'bottom-center'
                        });
                    }else{
                        spop({
                            template: 'Failed to delete',
                            position: 'bottom-center',
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
                    Sender.simplePost("/api/moveFile", {src: this.props.file, dest: path}, res => {
                        if (!res.failed) {
                            spop({
                                template: ['Moved', this.props.file, "to", path, 'Successfully'].join(""),
                                position: 'bottom-center'
                            });
                        }else{
                            spop({
                                template: 'Failed to Move',
                                position: 'bottom-center',
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

    render(){
        const {file, className, showDirectChange} = this.props;
        const cn = classNames("file-change-tool-bar", className);

        return (
            <div className={cn} >
                <div className="explorer-delete-cmd fas fa-trash-alt"
                                title="Copy Del"
                                onClick={this.handleDelete.bind(this)}></div>
                <div className="explorer-delete-cmd fas fa-check"
                                title={"Move to " + userConfig.good_folder}
                                onClick={this.handleClose.bind(this, userConfig.good_folder)}></div>
                <div className="explorer-delete-cmd fas fa-times"
                                title={"Move to " + userConfig.not_good_folder}
                                onClick={this.handleClose.bind(this, userConfig.not_good_folder)}></div>
            </div>
        )
     }
}

FileChangeToolbar.propTypes = {
    file: PropTypes.string
};
