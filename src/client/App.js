import React, { Component } from 'react';
import './style/App.scss';
import './style/_toast.scss';
import './style/rc-pagination.scss';
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import OneBookOverview from "./OneBookOverview";
import OneBookWaterfall from "./OneBookWaterfall";
import VideoPlayer from "./VideoPlayer";
import TagPage from "./TagPage";
import ChartPage from "./ChartPage";
import AdminPage from "./AdminPage";
import HistoryPage from "./HistoryPage";
import HomePage from "./HomePage";
import { Switch, Route, Link, Redirect } from 'react-router-dom';
import screenfull from 'screenfull';
const clientUtil = require("./clientUtil");
const { getSearchInputText } = clientUtil;
import { ToastContainer } from 'react-toastify';
import ReactDOM from 'react-dom';
import Cookie from "js-cookie";
import 'react-toastify/dist/ReactToastify.css';
import { GlobalContext } from './globalContext'
import Sender from './Sender';


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
        
        //save result to session storage
        Sender.post('/api/getGeneralInfo', {}, res => {
            if (!res.isFailed()) {
                let data = res.json;
                this.setState({
                    context: data
                });
                sessionStorage.setItem('GeneralInfo', JSON.stringify(data));
                // Cookie.set('GeneralInfo', JSON.stringify(data), { expires: 1/(24/3) });
            }
        });
    }

    componentDidMount() {
        this._handleKeyDown = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this._handleKeyDown);
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

    onSearchClick(event) {
        this.searchText = getSearchInputText();
        if (this.searchText.trim) {
            this.searchText = this.searchText.trim();
        }
        this.forceUpdate();
    }

    onFilterClick(event) {
        this.filterText = getSearchInputText();
        this.forceUpdate();
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

    getPasswordInput() {
        const pathInput = ReactDOM.findDOMNode(this.passwordInputRef);
        const text = (pathInput && pathInput.value) || "";
        return text;
    }

    setPasswordCookie() {
        const text = this.getPasswordInput();
        Cookie.set("home-password", text, { expires: 3 });
        this.forceUpdate();
    }

    renderPasswordInput() {
        let content = (<React.Fragment>
            <div className="admin-section-title">Enter password to use Shigureader</div>
            <div className="admin-section-content">
                <input className="admin-intput" ref={pathInput => this.passwordInputRef = pathInput}
                    placeholder="...type here" onChange={this.setPasswordCookie.bind(this)} />
            </div>
        </React.Fragment>);

        return (
            <div className="home-admin-section">
                {content}
            </div>
        )
    }

    render() {
        if (!clientUtil.isAllowedToEnter()) {
            return this.renderPasswordInput();
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


        const topNav = !isOneBook && (
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
                        <div onClick={this.onFilterClick.bind(this)} title="Filter Files" className="fa fa-filter filter-button" />}
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