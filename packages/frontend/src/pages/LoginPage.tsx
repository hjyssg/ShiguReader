
import React, { Component, ReactNode, KeyboardEvent } from 'react';
import ReactDOM from 'react-dom';
import { login } from '@api/auth';

interface LoginPageState {
    errMessage?: string;
}

class LoginPage extends Component<{}, LoginPageState> {
    state: LoginPageState = {};
    passwordInputRef: HTMLInputElement | null = null;

    getPasswordInput(): string {
        const pathInput = ReactDOM.findDOMNode(this.passwordInputRef) as HTMLInputElement;
        const text = (pathInput && pathInput.value) || "";
        return text;
    }

    async setPasswordCookie(): Promise<void> {
        const text = this.getPasswordInput();
        const res = await login(text);
        if (!(res as any).isFailed()) {
            const prevUrl = sessionStorage.getItem('url_before_login') || "/";
            if (prevUrl === window.location.href) {
                location.reload();
            } else {
                window.location.href = prevUrl;
            }
        } else {
            this.setState({ errMessage: "Wrong Password" });
        }
    }

    render(): ReactNode {
        let content = (<React.Fragment>
            <div className="admin-section-title">ShiguReader</div>
            <div className="admin-section-content">
                <input
                    className="admin-intput"
                    id="login-input"
                    type="password"
                    placeholder="password here..."
                    ref={pathInput => this.passwordInputRef = pathInput}
                    onChange={() => this.setState({ errMessage: "" })}
                    onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.which === 13 || e.keyCode === 13) {
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
