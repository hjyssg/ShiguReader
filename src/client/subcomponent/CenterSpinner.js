import React, { Component } from 'react';
import '../style/Spinner.scss';
import PropTypes from 'prop-types';
var classNames = require('classnames');
import Spinner from './Spinner';
const clientUtil = require("../clientUtil");
const { getDir, getBaseName } = clientUtil;

export default class CenterSpinner extends Component {
  render() {
      let text = undefined;
      if (this.props.text) {
        if (this.props.splitFilePath) {
          text = <div className="title">
            <div>{getBaseName(this.props.text)}</div>
            <div>{getDir(this.props.text)}></div>
          </div>
        } else {
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
