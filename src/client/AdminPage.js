import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/AdminPage.scss';
import Sender from './Sender';
const userConfig = require('../user-config');
import _ from "underscore";
// const util = require("../util");
// const nameParser = require('../name-parser');
// const filesizeUitl = require('filesize');
// import CenterSpinner from './subcomponent/CenterSpinner';
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
const filesizeUitl = require('filesize');
import Cookie from "js-cookie";
const clientUtil = require("./clientUtil");
const { getPathFromLocalStorage } = clientUtil;
import { Link } from 'react-router-dom';


export default class AdminPage extends Component {
    constructor(prop) {
        super(prop);
        this.failedTimes = 0;
        this.state = { prePath : userConfig.folder_list[0] };
    }

    componentDidMount() {
        if(this.failedTimes < 3) {
            this.askCacheInfo();
        }
    }

    askCacheInfo(){
        Sender.get("/api/cacheInfo", res => {
            this.handleRes(res);
        });
    }

    handleRes(res){
        if (!res.failed) {
            let { totalSize, cacheNum, thumbnailNum } = res;
            this.setState({totalSize, cacheNum, thumbnailNum})
        }else{
            this.failedTimes++;
        }
        this.res = res;
        this.forceUpdate();
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
            prePath : typeof e === "string"? e :  e.target.value
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
        const timeToFileHash = Cookie.get();
        const times = _.keys(timeToFileHash);
        times.sort((a, b) => (a -b));

        const visited = {};

        const history = times.map(t => {
            const hash = timeToFileHash[t];
            const fileName =  getPathFromLocalStorage(hash);
            if(!hash || visited[hash] || !fileName){
                return;
            }
            visited[hash] = true;
            const toUrl =  '/onebook/' + hash;
            return (
            <Link to={toUrl}  key={hash} className={""}>
                <div className="history-one-line-list-item" key={fileName}>
                    <i className="fas fa-book"></i>
                    <span className="history-one-line-list-item-text">{fileName}</span>
                </div>
            </Link>);
        });

        return (
        <div className="history-section admin-section">
            <div className="admin-section-title"> Recent  Read</div>
            {history}
        </div>)
    }

    render(){
        document.title = "Admin"
        const folder_list = userConfig.folder_list.concat("All_Pathes");

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
                <div className="admin-section">
                    <div className="admin-section-title"> Pregenerate Thumbnail</div>
                    <div className="admin-section-content">
                        <RadioButtonGroup checked={folder_list.indexOf(this.state.prePath)} 
                                        options={folder_list} name="pregenerate" onChange={this.onPathChange.bind(this)}/>
                        <input className="aji-path-intput" ref={pathInput => this.pathInputRef = pathInput} placeholder="...or any other path"/>
                        <div className="submit" onClick={this.onPrenerate.bind(this)}>Submit</div>
                    </div>
                </div>

                <div className="admin-section">
                    <div className="admin-section-title" title="only keep thumbnail and delete other files"> Clean Cache</div>
                    {cacheInfo}
                    <div className="admin-section-content">
                        <div className="submit" onClick={this.cleanCache.bind(this)}>clean</div>
                        <span className="admin-section-text" > only keep thumbnails and delete other files</span>
                        {/* <div className="submit" onClick={this.cleanCache.bind(this, "minized")}>clean and make thumbnail file smaller to save distk space</div> */}
                    </div>
                </div>


                {this.renderHistory()}

                <div className="author-link"> 
                        <a className="fab fa-github" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank"> Created By Aji47 </a> 
                </div>
            </div>)
        
    }
}

AdminPage.propTypes = {
    res: PropTypes.object
};
