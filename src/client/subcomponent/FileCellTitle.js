import React, { Component } from 'react';
const classNames = require('classnames');


export default class FileCellTitle extends Component {
    render() {
        const { str } = this.props;
        const fl = str.length;
        const cellTitleCn = classNames("file-cell-title", {
            "f-s-12": fl > 30,
            "f-s-14": fl <= 30
        });
        return (<center className={cellTitleCn} title={str}>{str}</center>)
    }
}


