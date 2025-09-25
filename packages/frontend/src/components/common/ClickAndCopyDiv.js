import React, { Component } from 'react';
// import '../../styles/textDiv.scss';
var classNames = require('classnames');
const clientUtil = require("../../utils/clientUtil");
import { toast } from 'react-toastify';
import _ from 'underscore';


function onTitleClick(text) {
  clientUtil.CopyToClipboard(text);
  toast('Copied to Clipboard', {
    className: "one-line-toast",
    position: "top-right",
    autoClose: 3 * 1000,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true
  })
}

export default function ClickAndCopyDiv(props) {
    const { text, className } = props;
    const cn2 = classNames("click-and-copy-text", className, "fas fa-copy");
    return (
        <span onClick={()=>onTitleClick(text)} className={cn2} />
    )
}
