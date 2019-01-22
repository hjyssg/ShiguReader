import React, { Component } from 'react';
import './style/app.css';
import _ from "underscore";
import Nav from 'react-bootstrap/lib/Nav';
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import TagPage from "./TagPage";
import Sender from './Sender';
import { Switch, Route, Link } from 'react-router-dom';
import Cookies from 'universal-cookie';
import stringHash from "string-hash";
import PropTypes from 'prop-types';


const userConfig = require('../user-config');


const imageTypes = ['.jpg', '.png'];
const compressTypes = ['.zip', '.rar'];
_.isImage = function (fn) {
    return imageTypes.some(e => fn.endsWith(e));
};
_.isCompress = function (fn) {
    return compressTypes.some(e => fn.endsWith(e));
};

_.getDir = function (fn) {
    //get parent
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

_.getFn = function (fn) {
    const tokens = fn.split('\\');
    return tokens[tokens.length - 1];
};

// http://localhost:3000/
class App extends Component {
    
    constructor(props) {
        super(props);
        this.state = {};

        this.cookies = new Cookies();

        userConfig.home_pathes.forEach(e => this.cookies.set(stringHash(e) , e)); 
    }
    
    RenderSubComponent() {
        const cookies = this.cookies;
        const renderOneBook = (props) => { return (<OneBook {...props} cookies={cookies}/>)};

        const renderExplorer = (props) => { return (<ExplorerPage  {...props} cookies={cookies} />)};

        const renderTagPage = (props) => { return (<TagPage mode="tag" {...props} cookies={cookies}/>)};
        const renderAuthorPage = (props) => { return (<TagPage mode="author" {...props} cookies={cookies}/>)};                                                       

        const result = (
        <Switch>
            <Route exact path='/' render={renderExplorer}/>
            <Route path='/explorer/:number' render={renderExplorer}/>
            <Route path='/tag/:tag' render={renderExplorer}/>
            <Route path='/onebook/:number' render={renderOneBook}/>
            <Route path='/tag' render={renderTagPage}/>
            <Route path='/author' render={renderAuthorPage}/>
        </Switch>
        );
        return result;
    }
    
    render() {
        // document.title = this.getWebTitle();
        const topNav = (
            <div className="topnav">
                <Link to='/' className="home-nav-item">Home</Link>
                <Link to='/author'>Author</Link>
                <Link to='/tag'>Tag</Link>
            </div>
        );
        
        return (
            <div className="app-container">
            {topNav}
            {this.RenderSubComponent()}
            </div>
        );
    }
}

App.propTypes = {
    
};

export default App;