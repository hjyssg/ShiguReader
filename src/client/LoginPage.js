import React, { Component } from 'react';

// import { Switch, Route, Link, Redirect } from 'react-router-dom';
// import screenfull from 'screenfull';
// const clientUtil = require("./clientUtil");
// const { getSearchInputText } = clientUtil;
import ReactDOM from 'react-dom';
// import Cookie from "js-cookie";
// import 'react-toastify/dist/ReactToastify.css';
// import { GlobalContext } from './globalContext'
import Sender from './Sender';


// http://localhost:3000/
class LoginPage extends Component {
    getPasswordInput() {
        const pathInput = ReactDOM.findDOMNode(this.passwordInputRef);
        const text = (pathInput && pathInput.value) || "";
        return text;
    }

    setPasswordCookie() {
        const text = this.getPasswordInput();
        Sender.post('/api/login', {"password":text}, res => {
            if (!res.isFailed()) {
                window.location.href = "/"
            }
        });
    }

    render() {
        let content = (<React.Fragment>
            <div className="admin-section-title">ShiguReader Login</div>
            <div className="admin-section-content">
                <input className="admin-intput" id="login-input" ref={pathInput => this.passwordInputRef = pathInput}
                    placeholder="password here..." onChange={this.setPasswordCookie.bind(this)} />

                <div className="author-link">
                    <a className="fab fa-github" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank"> Created By Aji47 </a>
                </div>
            </div>
        </React.Fragment>);

        return (
            <div className="app-container login-page">
                <div className="home-admin-section">
                    {content}
                </div>
            </div>
        )
    }


}

LoginPage.propTypes = {

};

export default LoginPage;