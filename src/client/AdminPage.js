import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/AdminPage.scss';
import Sender from './Sender';
import _ from "underscore";
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import Cookie from "js-cookie";
import { Link } from 'react-router-dom';
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
const clientUtil = require("./clientUtil");
const { getBaseName } = clientUtil;
const dateFormat = require('dateformat');
const AdminUtil = require("./AdminUtil");

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
            this.askMinifyQueue();
        }
    }

    askMinifyQueue(){
        Sender.post("/api/minifyZipQue", { }, res => {
            if (!res.isFailed()) {
                let { minifyZipQue } = res.json;
                this.setState({minifyZipQue})
            }else{
                this.failedTimes++;
            }
        });
    }

    requestHomePagePathes() {
        Sender.post("/api/homePagePath", { }, res => {
            this.handleRes(res);
        });
    }

    askCacheInfo(){
        Sender.post("/api/cacheInfo", {}, res => {
            this.handleCacheRes(res);
        });
    }

    handleCacheRes(res){
        if (!res.isFailed()) {
            let { totalSize, cacheNum, thumbCount } = res.json;
            this.setState({totalSize, cacheNum, thumbCount})
        }else{
            this.failedTimes++;
        }
        this.res = res;
        this.forceUpdate();
    }

    handleRes(res){
        if (!res.isFailed()) {
            let {dirs} = res.json;
            this.setState({
                dirs: dirs || []
            })
        }else{
            this.res = res;
            this.failedTimes++;
            this.forceUpdate();
        }
    }


    onPrenerate(fastUpdateMode){
        const pathInput = ReactDOM.findDOMNode(this.pathInputRef);
        const path = pathInput.value || this.state.prePath;
        AdminUtil.askPregenerate(path, fastUpdateMode);
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
                Sender.post('/api/cleanCache', {}, res =>{
                    this.askCacheInfo()
                });
            } 
        });
    }

    renderHistory(){
        const history = clientUtil.getHistoryFromCookie();

       const groupByDay =  _.groupBy(history, e => {
            let d = new Date(e[0].getTime());
            d.setHours(0);
            d.setMinutes(0);
            d.setSeconds(0);
            d.setMilliseconds(0);
            return d.getTime();
        });

        const historyDom =  _.keys(groupByDay).map(key => {
            const timeStr = dateFormat(new Date(parseInt(key)), "dddd, mmmm dS, yyyy");
            let items = groupByDay[key];

            items = _.sortBy(items, e => e[0].getTime());

            const dayHistory = items.map(e => {
                const filePath = e[1];
                const toUrl =  clientUtil.getOneBookLink(filePath);
    
                return (
                    <Link to={toUrl}  key={filePath} className={"history-link"}>
                        <div className="history-one-line-list-item" key={filePath}>
                            <span className="file-text" title={filePath}> {getBaseName(filePath)}</span>
                        </div>
                    </Link>);
    
            })

            return (
                <div className="history-day-section">
                    <div className="date-text">
                         <span>{timeStr}</span>
                        <span>{`${items.length} items`}</span> 
                    </div>
                    {dayHistory}
                </div>
            )
        })

        // const historyDom = history.map(e => {
        //     const timeStr = dateFormat(e[0], "mm-dd hh:MM");
        //     const filePath = e[1];
        //     const toUrl =  clientUtil.getOneBookLink(filePath);

        //     return (
        //         <Link to={toUrl}  key={filePath} className={"history-link"}>
        //             <div className="history-one-line-list-item" key={filePath}>
        //                 <span className="date-text"> {timeStr} </span>
        //                 <span className="file-text" title={filePath}> {getBaseName(filePath)}</span>
        //             </div>
        //         </Link>);

        // })
        
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
                        <div className="admin-section-title">Enter password to move/delete file </div>
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

 

    renderMinifyQueue(){
        const { minifyZipQue } = this.state;
        let items;
        if(!minifyZipQue || minifyZipQue.length === 0){
            items = "Empty Queue"
        }else{
            items = minifyZipQue.map(e => {
                return <div>{e} </div>
            });
        }
        
        return (
            <div className="admin-section">
                <div className="admin-section-title"> Zip Minify Queue</div>
                <div className="admin-section-content">
                    {items}
                </div>
            </div>)
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

        const { totalSize, cacheNum, thumbCount } = this.state
        const size = totalSize && clientUtil.filesizeUitl(totalSize);
        let cacheInfo;

        if(size){
            cacheInfo = 
            <div className="cache-info">
                <div className="cache-info-row">{`total size: ${size}`} </div>
                <div className="cache-info-row">{`${cacheNum} files can be deleted` } </div>
            </div>
        }

        return (
            <div className="admin-container container">
                {this.renderPasswordInput()}

                <div className="admin-section">
                    <div className="admin-section-title"> Pregenerate Thumbnail and Update Internal Database</div>
                    <div className=""> {` There are ${thumbCount||0} thumbnail exsiting` } </div>
                    <div className="admin-section-content">
                        <RadioButtonGroup checked={folder_list.indexOf(this.state.prePath)} 
                                        options={folder_list} name="pregenerate" onChange={this.onPathChange.bind(this)}/>
                        <input className="admin-intput" ref={pathInput => this.pathInputRef = pathInput} placeholder="...or any other path"/>
                        <div className="submit-button" onClick={this.onPrenerate.bind(this)}>Full Update (Regenerate all data and thumbnail)</div>
                        <div className="submit-button" onClick={this.onPrenerate.bind(this, true)}>Fast Update (Only generate new file)</div>
                    </div>
                </div>

                <div className="admin-section">
                    <div className="admin-section-title" title="only keep thumbnail and delete other files"> Clean Cache</div>
                    <div className="admin-section-content">
                        {cacheInfo}
                        <div className="submit-button" onClick={this.cleanCache.bind(this)}>clean</div>
                        {/* <div className="submit-button" onClick={this.cleanCache.bind(this, "minized")}>clean and make thumbnail file smaller to save distk space</div> */}
                    </div>
                </div>

                {this.renderHistory()}

                {this.renderMinifyQueue()}

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
