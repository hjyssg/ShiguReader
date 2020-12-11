import React, { Component } from 'react';
import '../style/Spinner.scss';
const classNames = require('classnames');



export default class Spinner extends Component {
     render(){
        const {className} = this.props;
        const cn = classNames("lds-spinner", className);
        return (
        <div className={cn}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        </div>);
     }
}


