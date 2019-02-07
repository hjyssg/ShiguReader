import React, { Component } from 'react';
import '../style/Spinner.scss';
import PropTypes from 'prop-types';
var classNames = require('classnames');
import Spinner from './Spinner';

export default class CenterSpinner extends Component {
     render(){
        return (
        <div className="loading-container">
            <div className="loading-inner">
              {<Spinner />}
              { "Loading..."}
            </div>
        </div>)
     }
}

CenterSpinner.propTypes = { 
};
