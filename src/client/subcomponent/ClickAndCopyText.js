import React, { Component } from 'react';
import '../style/Spinner.scss';
import PropTypes from 'prop-types';
var classNames = require('classnames');
const spop  = require("./spop");
const util = require("../../util");

export default class ClickAndCopyText extends Component {
  onTitleClick(){
    //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
    var textArea = document.createElement("textarea");
    textArea.value = this.props.text;
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
    const { text, className, ...others } = this.props;
    const cn = classNames("click-and-copy-text", className)
    return(<span onClick={this.onTitleClick.bind(this)} className={cn}>
             {this.props.text} 
            </span>)
  }
}

ClickAndCopyText.propTypes = { 
  text: PropTypes.string
};
