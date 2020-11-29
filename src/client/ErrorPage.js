import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/ErrorPage.scss';

export default class ErrorPage extends Component {
     render(){
        let {filePath, res} = this.props;
        let {status, statusText} = res;

        let text;

        if(status === 504){
            text = "Is the server running right now?";
        }  else if(status === 404 && filePath){
            text = `Could not find ${filePath}.`;
        } else if (status === 500 && filePath){
            text = `${filePath} is a broken file`;
        } else if(res.isFailed()){
            status = "ERROR"
            statusText = res.json.reason;
            text = filePath;
        }

        return (
        <div id="notfound" className="error-page-container">
            <div className="notfound">
                <div className="notfound-404">
                    {status}
                </div>
                <h2>{statusText}</h2>
                {/* <a href="#">Go To Homepage</a> */}
            </div>
            <div className="error-user-text">{text}</div>
        </div>);
     }
}

ErrorPage.propTypes = {
    res: PropTypes.object,
    userText: PropTypes.string
};
