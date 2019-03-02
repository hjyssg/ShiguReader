import React, { Component } from 'react';
import '../style/Spinner.scss';
import PropTypes from 'prop-types';
var classNames = require('classnames');
import Spinner from './Spinner';
const util = require("../../util");

export default class CenterSpinner extends Component {
     render(){
        let text = undefined;
        if(this.props.text){
          if(this.props.splitFilePath){
            text = <div className="title">
                      <div>{util.getFn(this.props.text)}</div>
                      <div>{util.getDir(this.props.text)}></div>
                  </div>
          }else{
            text = <div className="title">{this.props.text}</div>
          }
        }

        return (
        <div className="loading-container">
            <div className="loading-inner">
              {<Spinner />}
              {text}
              <div>is Loading</div>
            </div>
        </div>)
     }
}

CenterSpinner.propTypes = { 
  text: PropTypes.string,
  splitFilePath: PropTypes.bool
};
