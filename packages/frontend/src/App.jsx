import React, { Component } from 'react';
import '@styles/App.scss';
import '@styles/_toast.scss';
import '@styles/rc-pagination.scss';
import ExplorerPage from '@pages/ExplorerPage';
import OneBook from '@pages/OneBook';
import OneBookOverview from '@pages/OneBookOverview';
import OneBookWaterfall from '@pages/OneBookWaterfall';
import VideoPlayer from '@pages/VideoPlayer';
import TagPage from '@pages/TagPage';
import ChartPage from '@pages/ChartPage';
import AdminPage from '@pages/AdminPage';
import HistoryPage from '@pages/HistoryPage';
import HomePage from '@pages/HomePage';
import LoginPage from '@pages/LoginPage';
import { Switch, Route, Link, Redirect } from 'react-router-dom';
import screenfull from 'screenfull';
const clientUtil = require('@utils/clientUtil');
const { getSearchInputText } = clientUtil;
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GlobalContext } from '@context/GlobalContext';
import Sender from '@services/Sender';
const nameParser = require('@name-parser');


// http://localhost:3000/
class App extends Component {

    constructor(props) {
        super(props);
        this.state = {};

        // let data = Cookie.get('GeneralInfo');
        // let data = sessionStorage.getItem('GeneralInfo');
        // if (data) {
        //     this.state = {
        //         context: JSON.parse(data)
        //     };
        // } 
        
        this.askServer();
    }

    async askServer() {
        // this.getParseCache();

        const generalRes = await Sender.getWithPromise('/api/getGeneralInfo');
        if (!generalRes.isFailed()) {
            let data = generalRes.json;
            this.setState({
                context: data
            });
            sessionStorage.setItem('GeneralInfo', JSON.stringify(data));
        }
    }

    // async getParseCache(){
    //     const parseCacheRes = await Sender.getWithPromise('/api/getParseCache/');
    //     if (!parseCacheRes.isFailed()) {
    //         console.time("setLocalCache");
    //         nameParser.setLocalCache(parseCacheRes.json)
    //         console.timeEnd("setLocalCache");
    //     }
    // }

    componentDidMount() {
        this._handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this._handleKeyDown);

        const path = window.location.pathname;
        const isLoginPage = path.includes("/login");
        if (!clientUtil.isAllowedToEnter() && !isLoginPage) {
            sessionStorage.setItem('url_before_login', window.location.href||"");
            window.location.href = "/login";
        }else if(clientUtil.isAllowedToEnter() && isLoginPage){
            window.location.href = "/";
        }

        //菜单
        console.log(`应该安排点彩蛋在这边。\n先放个 https://github.com/hjyssg/ShiguReader   `)
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this._handleKeyDown);
    }

    handleKeyDown(e) {
        if (e.which === 13 || e.keyCode === 13) {
            //enter key to toggle 
            if (e.target.tagName !== "INPUT") {
                screenfull.toggle();
            }
        }
    }

    onSearchKeydown(e) {
        if (e.which === 13 || e.keyCode === 13) {
            //enter key
            this.onSearchClick();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    askRerender(){
        this.setState({
            rerenderTick: !this.state.rerenderTick
        })
    }

    onSearchClick(event) {
        this.searchText = getSearchInputText();
        if (this.searchText.trim) {
            this.searchText = this.searchText.trim();
        }
        this.askRerender();
    }

    onFilterClick(event) {
        this.filterText = getSearchInputText();
        this.askRerender();
    }

    RenderSubComponent() {
        const renderOneBook = (props) => { return (<OneBook {...props} />) };
        const renderOneBookOverview = (props) => { return (<OneBookOverview {...props} />) };
        const renderOneBookWaterfall = (props) => { return (<OneBookWaterfall {...props} />) };

        const renderVideo = (props) => { return (<VideoPlayer {...props} />) };

        const renderHomePage = (props) => { return (<HomePage {...props} />) };
        const renderExplorer = (props) => { return (<ExplorerPage  {...props} filterText={this.filterText} />) };

        const renderTagPage = (props) => { return (<TagPage mode="tag" filterText={this.filterText} {...props} />) };
        const renderAuthorPage = (props) => { return (<TagPage mode="author" filterText={this.filterText} {...props} />) };

        const renderChartPage = (props) => { return (<ChartPage {...props} />) };
        const renderHistoryPage = (props) => { return (<HistoryPage {...props} />) };
        const renderAdminPage = (props) => { return (<AdminPage {...props} />) };
        const renderLoginPage = (props) => { return (<LoginPage {...props} />) };


        const result = (
            <Switch>
                <Route exact path='/' render={renderHomePage} />
                <Route path='/explorer/' render={renderExplorer} />
                <Route path='/tag/' render={renderExplorer} />
                <Route path='/author/' render={renderExplorer} />
                <Route path='/search/' render={renderExplorer} />

                <Route path='/onebook/' render={renderOneBook} />
                <Route path='/onebookOverview/' render={renderOneBookOverview} />
                <Route path='/onebookWaterfall/' render={renderOneBookWaterfall} />


                <Route path='/tagPage/' render={renderTagPage} />
                <Route path='/authorPage/' render={renderAuthorPage} />
                <Route path='/videoPlayer/' render={renderVideo} />

                <Route path='/chart/' render={renderChartPage} />
                <Route path='/history/' render={renderHistoryPage} />
                <Route path='/admin' render={renderAdminPage} />
                <Route path='/login' render={renderLoginPage} />
            </Switch>
        );
        return result;
    }

    componentDidCatch(error, info) {
        // Display fallback UI
        this.setState({ hasError: true });
        // You can also log the error to an error reporting service
        console.error(error, info);
    }

    render() {
        if (this.state.hasError){
            return   (<div className="app-container">
                <div className='critical-error'>
                    Web Error. 
                    Please check F12 to debug.
                </div>
             </div> ) 
        }

        // document.title = this.getWebTitle();
        if (this.searchText) {
            const path = clientUtil.getSearhLink(this.searchText);
            this.searchText = "";
            return (<Redirect
                to={{
                    pathname: path,
                }} />);
        }

        const path = window.location.pathname;
        const isOneBook = path.includes("/onebook");
        const isExplorer = path.includes("/explorer");
        const isTag = path.includes("/tagPage");
        const isAuthor = path.includes("/author");
        const isSearch = path.includes("/search");
        const isLogin = path.includes("/login");
        const isVideo = path.includes("/videoPlayer")

        const topNav = !isOneBook && !isLogin && !isVideo && (
            <div className="app-top-topnav container">
                <div className="app-page-links row">
                    <Link to='/'><i className="fas fa-home">Home</i></Link>
                    <Link to='/authorPage/'><i className="fas fa-pen">Authors</i></Link>
                    <Link to='/tagPage/'><i className="fas fa-tags">Tags</i></Link>
                    <Link to='/chart'><i className="fas fa-chart-bar">Chart</i></Link>
                    <Link to='/history'><i className="fas fa-history">History</i></Link>
                    <Link to='/admin'><i className="fas fa-tools">Admin</i></Link>
                </div>
                <div className="search-bar">
                    <input className="search-input" type="text" placeholder="Search.." onKeyDown={this.onSearchKeydown.bind(this)} />
                    <div onClick={this.onSearchClick.bind(this)} title="Search" className="fa fa-search search-button" />
                    {(isExplorer || isTag || isAuthor || isSearch) &&
                        <div onClick={this.onFilterClick.bind(this)} title="Filter Current Page's Files" className="fa fa-filter filter-button" />}
                </div>
            </div>
        );

        return (
            <GlobalContext.Provider value={(this.state.context || {})}>
                <div className="app-container">
                    {topNav}
                    {this.RenderSubComponent()}
                    <ToastContainer />
                </div>
            </GlobalContext.Provider>
        );
    }
}

App.propTypes = {

};

export default App;
