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
    state = {};

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
            }else{
                this.setState({errMessage: "Wrong Password"});
            }
        });
    }

    render() {
        let content = (<React.Fragment>
            <div className="admin-section-title">ShiguReader</div>
            <div className="admin-section-content">
                <input className="admin-intput" id="login-input" ref={pathInput => this.passwordInputRef = pathInput}
                    placeholder="password here..." onChange={()=> this.setState({errMessage: ""})}   type="password"/>
                <button onClick={this.setPasswordCookie.bind(this)}> Login </button>
                <div id="log-err"> {this.state.errMessage} </div>
                <div className="author-link">
                    <a className="fab fa-github" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank"> Created By Aji47 </a>
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

LoginPage.propTypes = {

};

export default LoginPage;