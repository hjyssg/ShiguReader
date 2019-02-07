import React, { Component } from 'react';
import '../style/Spinner.scss';
const spop  = require("./spop");
const userConfig = require('../../user-config');
import PropTypes from 'prop-types';
var classNames = require('classnames');

export default class FileChangeToolbar extends Component {
    copyToClipboard(path, mode){
        //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
        var textArea = document.createElement("textarea");
        if(mode === "delete"){
            textArea.value = "DEL /f \"" +  path + "\"";
        } else if(mode === "good"){
            textArea.value = "MOVE \"" +  path + "\"" + "  \"" + userConfig.good_folder +"\"";
        }else if(mode === "not_good"){
            textArea.value = "MOVE \"" +  path + "\"" + "   \"" + userConfig.not_good_folder +"\"";
        }

        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
    
        spop({
          template: 'Copied to Clipboard',
          position: 'bottom-right',
          autoclose: 3000
        });
    }


     render(){
        const {file, className} = this.props;
        const cn = classNames("file-change-tool-bar", className);

        return (
            <div className={cn} >
                <div className="explorer-delete-cmd fas fa-trash-alt"
                                title="Copy Del"
                                onClick={this.copyToClipboard.bind(this, file, "delete")}></div>
                <div className="explorer-delete-cmd fas fa-check"
                                title={"Move to " + userConfig.good_folder}
                                onClick={this.copyToClipboard.bind(this, file, "good")}></div>
                <div className="explorer-delete-cmd fas fa-times"
                                title={"Move to " + userConfig.not_good_folder}
                                onClick={this.copyToClipboard.bind(this, file, "not_good")}></div>
        </div>
        )
     }
}



FileChangeToolbar.propTypes = {
    file: PropTypes.string
};
