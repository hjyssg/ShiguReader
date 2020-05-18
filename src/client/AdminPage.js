import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/AdminPage.scss';
import Sender from './Sender';
import _ from "underscore";
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import Cookie from "js-cookie";
import { Link } from 'react-router-dom';
const userConfig = require('../user-config');
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
const filesizeUitl = require('filesize');
const clientUtil = require("./clientUtil");
const { getBaseName } = clientUtil;
const dateFormat = require('dateformat');

export default class AdminPage extends Component {
    constructor(prop) {
        super(prop);
        this.failedTimes = 0;
        this.state = { prePath : null, dirs: [] };
    }

    componentDidMount() {
        if(this.failedTimes < 3) {
            this.askCacheInfo();
            this.requestHomePagePathes();
        }

    }

    requestHomePagePathes() {
        Sender.post("/api/homePagePath", { }, res => {
            this.handleRes(res);
        });
    }

    askCacheInfo(){
        Sender.get("/api/cacheInfo", res => {
            this.handleCacheRes(res);
        });
    }

    handleCacheRes(res){
        if (!res.failed) {
            let { totalSize, cacheNum, thumbnailNum } = res;
            this.setState({totalSize, cacheNum, thumbnailNum})
        }else{
            this.failedTimes++;
        }
        this.res = res;
        this.forceUpdate();
    }

    handleRes(res){
        if (!res.failed) {
            let {dirs} = res;
            this.setState({
                dirs: dirs || []
            })
        }else{
            this.res = res;
            this.failedTimes++;
            this.forceUpdate();
        }
    }


    onPrenerate(){
        const pathInput = ReactDOM.findDOMNode(this.pathInputRef);
        const path = pathInput.value || this.state.prePath;

        Swal.fire({
            title: "Pregenerate Thumbnail",
            text:  path,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                const reqB = {
                    path: path
                }
                Sender.post('/api/pregenerateThumbnails', reqB, res =>{
                    console.log(res)
                });
            } 
        });
    }

    onPathChange(e){
        this.setState({
            prePath : _.isString(e)? e :  e.target.value
        })
    }

    cleanCache(minized){
        Swal.fire({
            title: "Clean Cache",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.simplePost('/api/cleanCache', {}, res =>{
                    this.askCacheInfo()
                });
            } 
        });
    }

    renderHistory(){
        const history = clientUtil.getHistoryFromCookie();

        const historyDom = history.map(e => {
            const timeStr = dateFormat(e[0], "mm-dd hh:MM");
            const filePath = e[1];
            const toUrl =  clientUtil.getOneBookLink(filePath);

            return (
                <Link to={toUrl}  key={filePath} className={"history-link"}>
                    <div className="history-one-line-list-item" key={filePath}>
                        <span className="date-text"> {timeStr} </span>
                        <span className="file-text" title={filePath}> {getBaseName(filePath)}</span>
                    </div>
                </Link>);

        })
        
        return (
        <div className="history-section admin-section">
            <div className="admin-section-title"> Recent Read</div>
            <div className="admin-section-content">
                {historyDom}
            </div>
        </div>)
    }

    getPasswordInput(){
        const pathInput = ReactDOM.findDOMNode(this.passwordInputRef);
        const text = (pathInput && pathInput.value) || "";
        return text;
    }

    setPasswordCookie(){
        const text = this.getPasswordInput();
        Cookie.set("password", text, { expires: 3 });
        this.forceUpdate();
    }

    renderPasswordInput(){
        let content;
        if(clientUtil.isAuthorized()){
            content = (<div className="admin-section-title"> You are authorized to move/delete files. </div>)
        }else{
            content = (<React.Fragment>
                        <div className="admin-section-title">Type password to move/delete file </div>
                        <div className="admin-section-content">
                        <input className="admin-intput" ref={pathInput => this.passwordInputRef = pathInput}
                                    placeholder="...type here"  onChange={this.setPasswordCookie.bind(this)}/>
                        </div>
                        </React.Fragment>);
        }

        return (
            <div className="admin-section">
                {content}
            </div>
        )
    }

    onclickShutDown(){
        Swal.fire({
            title: "Remote Shutdown",
            text:  "Do you want to shut down your computer?",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.post('/api/shutdownServer', {}, res =>{
                    //send another request  to check if shut down?
                    alert("You computer is shut down");
                });
            } 
        });
    }

    renderRemoteShutDown(){
        if(clientUtil.isLocalHost() || !clientUtil.isAuthorized()){
            return;
        }

       return <button onClick={this.onclickShutDown.bind(this)}> Recomote shutdown </button>;
    }

    render(){
        document.title = "Admin"
        const folder_list = this.state.dirs.concat("All_Pathes");

        const { totalSize, cacheNum, thumbnailNum } = this.state
        const size = totalSize && filesizeUitl(totalSize, {base: 2});
        let cacheInfo;

        if(size){
            cacheInfo = 
            <div className="cache-info">
                <div className="cache-info-row">{`total size: ${size}`} </div>
                <div className="cache-info-row">{`${cacheNum-thumbnailNum} files can be deleted` } </div>
                <div className="cache-info-row">{`${thumbnailNum} minified thumbnails should be reserved`} </div>
            </div>
        }

        return (
            <div className="admin-container container">
                {this.renderPasswordInput()}

                <div className="admin-section">
                    <div className="admin-section-title"> Pregenerate Thumbnail and Update Internal Database</div>
                    <div className="admin-section-content">
                        <RadioButtonGroup checked={folder_list.indexOf(this.state.prePath)} 
                                        options={folder_list} name="pregenerate" onChange={this.onPathChange.bind(this)}/>
                        <input className="admin-intput" ref={pathInput => this.pathInputRef = pathInput} placeholder="...or any other path"/>
                        <div className="submit-button" onClick={this.onPrenerate.bind(this)}>Submit</div>
                    </div>
                </div>

                <div className="admin-section">
                    <div className="admin-section-title" title="only keep thumbnail and delete other files"> Clean Cache</div>
                    <div className="admin-section-content">
                        {cacheInfo}
                        <div className="submit-button" onClick={this.cleanCache.bind(this)}>clean</div>
                        <span className="" > only keep thumbnails and delete other files</span>
                        {/* <div className="submit-button" onClick={this.cleanCache.bind(this, "minized")}>clean and make thumbnail file smaller to save distk space</div> */}
                    </div>
                </div>

                {this.renderHistory()}

                {this.renderRemoteShutDown()}

                <div className="author-link"> 
                        <a className="fab fa-github" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank"> Created By Aji47 </a> 
                </div>
            </div>)
        
    }
}

AdminPage.propTypes = {
    res: PropTypes.object
};
