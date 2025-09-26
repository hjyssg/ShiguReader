import React, { Component } from 'react';

// import { Switch, Route, Link, Redirect } from 'react-router-dom';
// import screenfull from 'screenfull';
// const clientUtil = require("../utils/clientUtil");
// const { getSearchInputText } = clientUtil;
import ReactDOM from 'react-dom';
// import Cookie from "js-cookie";
// import 'react-toastify/dist/ReactToastify.css';
// import { GlobalContext } from '../context/GlobalContext';
import Sender from '@services/Sender';


// http://localhost:3000/
class LoginPage extends Component {
    state = {};

    getPasswordInput() {
        const pathInput = ReactDOM.findDOMNode(this.passwordInputRef);
        const text = (pathInput && pathInput.value) || "";
        return text;
    }

    async setPasswordCookie() {
        const text = this.getPasswordInput();
        const res = await Sender.postWithPromise('/api/login', {"password":text});
        if (!res.isFailed()) {
            //跳转回login之前的页面
            const prevUrl = sessionStorage.getItem('url_before_login') || "/";
            if(prevUrl == window.location.href){
                location.reload(true);
            }else{
                window.location.href = prevUrl;
            }
        }else{
            this.setState({errMessage: "Wrong Password"});
        }
    }

    render() {
        let content = (<React.Fragment>
            <div className="admin-section-title">ShiguReader</div>
            <div className="admin-section-content">
                <input className="admin-intput" id="login-input"   type="password"    placeholder="password here..." 
                    ref={pathInput => this.passwordInputRef = pathInput}
                    onChange={()=> this.setState({errMessage: ""})}   
                    onKeyPress={e => {
                        if (e.which === 13 || e.keyCode === 13) {
                        //enter key
                        this.setPasswordCookie();
                        e.preventDefault();
                        e.stopPropagation();
                        }
                    }}
                    />
                <button onClick={this.setPasswordCookie.bind(this)}> Login </button>
                <div id="log-err"> {this.state.errMessage} </div>
                <div className="author-link">
                    <a className="author-link-item" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank" rel="noreferrer">
                        <i className="fab fa-github author-link-icon" aria-hidden="true"></i>
                        <span className="author-link-text">Created By Aji47</span>
                    </a>
                </div>
            </div>
        </React.Fragment>);

        return (
            <div className="app-container login-page">
                <div className="log-section">
                    {content}
                </div>
            </div>
        )
    }
}


export default LoginPage;
