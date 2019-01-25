import React, { Component } from 'react';
import '../style/Spinner.scss';


export default class Spinner extends Component {
     render(){
        return (
        <div className="lds-spinner">
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


