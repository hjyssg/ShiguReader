import React, { Component } from 'react';
import './style/App.scss';
import './style/spop.scss';
import './style/rc-pagination.scss';
import _ from "underscore";
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import TagPage from "./TagPage";
import { Switch, Route, Link, Redirect } from 'react-router-dom';
import Cookies from 'universal-cookie';
import stringHash from "string-hash";

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
    if(!fn){return ""};
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

_.getFn = function (fn) {
    if(!fn){return ""};
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

    onSearchClick(event) {
        this.searchText = document.getElementsByClassName('search-input')[0].value;
        this.forceUpdate();
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
            <Route path='/author/:author' render={renderExplorer}/>
            <Route path='/search/:search' render={renderExplorer}/>

            <Route path='/onebook/:number' render={renderOneBook}/>
            <Route path='/tag' render={renderTagPage}/>
            <Route path='/author' render={renderAuthorPage}/>
        </Switch>
        );
        return result;
    }
    
    render() {
        // document.title = this.getWebTitle();
        if(this.searchText){
            const path = "/search/" + this.searchText;
            this.searchText = "";
            return (<Redirect
                to={{
                    pathname: path,
                }}/>);
        }

        const topNav = !window.location.pathname.includes("/onebook") && (
            <div className="topnav container">
                <div className="links">
                <Link to='/'><i className="fas fa-home">Home</i></Link>
                <Link to='/author'><i className="fas fa-pen">Authors</i></Link>
                <Link to='/tag'><i className="fas fa-tags">Tags</i></Link>
                </div>
                <div className="search-bar">
                    <input className="search-input" type="text" placeholder="Search.."/>
                    <button  onClick={this.onSearchClick.bind(this)}><i className="fa fa-search"></i></button>
                </div>
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