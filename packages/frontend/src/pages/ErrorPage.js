import React, { Component } from 'react';
import '../styles/ErrorPage.scss';
import LoginPage from "./LoginPage";
const _ = require("underscore");


export default class ErrorPage extends Component {
    render() {
        let { filePath, res } = this.props;
        let { status, statusText } = res || {};

        let text;

        if (status === 504) {
            text = "The backend server did not start.";
        } else if (res.isFailed() && res.json.reason) {
            status = "ERROR"
            statusText = _.isString(res.json.reason)? res.json.reason: ""
            text = filePath;
        } else if (status === 404 && filePath) {
            text = `Could not find ${filePath}.`;
        } else if (status === 500 && filePath) {
            text = `${filePath} is a broken file`;
        }

        if(statusText === "You need to login"){
            sessionStorage.setItem('url_before_login', window.location.href||"");
            return <LoginPage />;
        }

        return (
            <div id="notfound" className="error-page-container">
                <div className="notfound">
                    <div className="notfound-404">
                        {status}
                    </div>
                    <h2>{statusText}</h2>
                    <h2 >{text}</h2>
                    {/* <a href="#">Go To Homepage</a> */}
                </div>

            </div>);
    }
}

