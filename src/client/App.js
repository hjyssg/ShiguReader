import React, { Component } from 'react';
import './style/App.scss';
import './style/spop.scss';
import './style/rc-pagination.scss';
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import TagPage from "./TagPage";
import ChartPage from "./ChartPage";
import AdminPage from "./AdminPage";
import { Switch, Route, Link, Redirect } from 'react-router-dom';


import _ from "underscore";
const util = require("../util");
util.attach(_);
import screenfull from 'screenfull';

// http://localhost:3000/
class App extends Component {
    
    constructor(props) {
        super(props);
        this.state = {};
    }

    componentDidMount(){
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
         if(key === "enter"){
            screenfull.toggle();
        }
      }

    onSearchClick(event) {
        this.searchText = document.getElementsByClassName('search-input')[0].value;
        if(this.searchText.trim){
            this.searchText = this.searchText.trim();
        }
        this.forceUpdate();
    }

    onFilterClick(event){
        this.filterText = document.getElementsByClassName('search-input')[0].value;
        this.forceUpdate();
    }
    
    RenderSubComponent() {
        const renderOneBook = (props) => { return (<OneBook {...props}/>)};

        const renderExplorer = (props) => { return (<ExplorerPage  {...props} filterText={this.filterText}  />)};

        const renderTagPage = (props) => { return (<TagPage mode="tag" filterText={this.filterText} {...props}/>)};
        const renderAuthorPage = (props) => { return (<TagPage mode="author" filterText={this.filterText} {...props}/>)}; 
        
        const renderChartPage = (props) =>  { return (<ChartPage {...props}/>)}; 

        const renderAdminPage = (props) =>  { return (<AdminPage {...props}/>)}; 

        const result = (
        <Switch>
            <Route exact path='/' render={renderExplorer}/>
            <Route path='/explorer/:number' render={renderExplorer}/>
            <Route path='/tag/:tag' render={renderExplorer}/>
            <Route path='/author/:author' render={renderExplorer}/>
            <Route path='/search/:search' render={renderExplorer}/>

            <Route path='/onebook/:number' render={renderOneBook}/>
            <Route path='/tagPage/:index' render={renderTagPage}/>
            <Route path='/authorPage/:index' render={renderAuthorPage}/>

            <Route path='/chart' render={renderChartPage}/>
            <Route path='/admin' render={renderAdminPage}/>

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

        const isHome =  window.location.pathname === "/";
        const isOneBook = window.location.pathname.includes("/onebook");
        const isExplorer = window.location.pathname.includes("/explorer");
        const isTag = window.location.pathname.includes("/tagPage");
        const isAuthor = window.location.pathname.includes("/author");

        const topNav = !isOneBook && (
            <div className="app-top-topnav container">
                <div className="links">
                    <Link to='/'><i className="fas fa-home">Home</i></Link>
                    <Link to='/authorPage/1'><i className="fas fa-pen">Authors</i></Link>
                    <Link to='/tagPage/1'><i className="fas fa-tags">Tags</i></Link>
                    <Link to='/chart'><i className="fas fa-chart-bar">Chart</i></Link>
                    <Link to='/admin'><i className="fas fa-tools">Admin</i></Link>
                </div>
                <div className="search-bar">
                    <input className="search-input" type="text" placeholder="Search.."/>
                    <button  onClick={this.onSearchClick.bind(this)} title="Search"><i className="fa fa-search"></i></button>
                    {(isExplorer || isTag || isAuthor)  && <button  onClick={this.onFilterClick.bind(this)} title="Filter Files"><i className="fa fa-filter"></i></button>}
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