import React, { Component, useState, useEffect } from 'react';
import '@styles/AdminPage.scss';
import Sender from '@services/Sender';
import _ from "underscore";
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import Cookie from "js-cookie";
// import { Link } from 'react-router-dom';
import RadioButtonGroup from '@components/common/RadioButtonGroup';
const clientUtil = require("@utils/clientUtil");
// const { getBaseName } = clientUtil;
const AdminUtil = require("@utils/AdminUtil");
import { GlobalContext } from '@context/GlobalContext';
// const util = require("@common/util");
const classNames = require('classnames');
import {QRCodeSVG} from 'qrcode.react';
import { toast } from 'react-toastify';

function MinifyZipQueSection(){
    const [minifyZipQue, setMinifyZipQue] = useState([]);

    useEffect(() => {
        Sender.post("/api/minifyZipQue", {}, res => {
            if (!res.isFailed()) {
                let { minifyZipQue } = res.json;
                setMinifyZipQue(minifyZipQue)
            }
        });
    }, []); 

    let items;
    if (minifyZipQue.length === 0) {
        items = "Empty Queue"
    } else {
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

function cleanCache(minized) {
    Swal.fire({
        title: "Clean Cache",
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    }).then((result) => {
        if (result.value === true) {
            Sender.post('/api/cleanCache', {}, res => {
                // this.askCacheInfo()
            });
        }
    });
}

function CacheSection(){
    const [totalSize, setTotalSize] = useState(0);
    const [cacheNum, setCacheNum] = useState(0);
    const [thumbCount, setThumbCount] = useState(0);


    useEffect(() => {
        Sender.post("/api/cacheInfo", {}, res => {
            if (!res.isFailed()) {
                let { totalSize, cacheNum, thumbCount } = res.json;
                setTotalSize(totalSize);
                setCacheNum(cacheNum);
                setThumbCount(thumbCount);
            }
        });
    }, []); 

    const size = totalSize && clientUtil.filesizeUitl(totalSize);
    let cacheInfo;
    cacheInfo =(
        <div className="cache-info">
            <div className="cache-info-row"> {`Thumbnail: ${thumbCount || 0}`} </div>
            <div className="cache-info-row">{`Cache Size: ${size}`} </div>
            <div className="cache-info-row">{`Cache File Number: ${cacheNum}`} </div>
        </div>);

    return (
        <div className="admin-section">
        <div className="admin-section-title" title="Only Keep Thumbnails and Delete Other Files"> Cache Usage (Restart ShiguReader will delete the cache)</div>
        <div className="admin-section-content">
            {cacheInfo}
                {/* <div className="submit-button" onClick={cleanCache}>clean</div> */}
            </div>
        </div>
    )
}

function LogoutSection(){
    function dologout(){
        Sender.post("/api/logout", {}, res => {
            if (!res.isFailed()) {
                window.location.replace("/");
            }
        });
    }
 
    return (
        <div className="admin-section">
        <div className="admin-section-title" title="Logout"> Logout</div>
        <div className="admin-section-content">
            <a className="btn btn-info" onClick={dologout}>
            <span className="glyphicon glyphicon-log-out"></span> Log out
            </a>
        </div>
        </div>
    )
}

export default class AdminPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = { prePath: null, dirs: [] };
    }

    componentDidMount() {
        this.requestHomePagePathes();
    }

    async requestHomePagePathes() {
        const res = await Sender.getWithPromise("/api/homePagePath");
        if (!res.isFailed()) {
            let { dirs } = res.json;
            this.setState({
                dirs: dirs || []
            })
        }
    }

    onPrenerate(fastUpdateMode) {
        const pathInput = ReactDOM.findDOMNode(this.pathInputRef);
        const path = pathInput.value || this.state.prePath;
        AdminUtil.askPregenerate(path, fastUpdateMode);
    }

    onPathChange(e) {
        this.setState({
            prePath: _.isString(e) ? e : e.target.value
        })
    }

    getPasswordInput() {
        const pathInput = ReactDOM.findDOMNode(this.passwordInputRef);
        const text = (pathInput && pathInput.value) || "";
        return text;
    }

    askRerender(){
        this.setState({
            rerenderTick: !this.state.rerenderTick
        })
    }

    setPasswordCookie() {
        const text = this.getPasswordInput();
        Cookie.set("password", text, { expires: 3 });
        this.askRerender();
    }

    renderPasswordInput() {
        // return null;

        // let content;
        // const { etc_config } = this.context;
        // if (clientUtil.isAuthorized(etc_config)) {
        //     content = (<div className="admin-section-title"> You are authorized to move/delete files. </div>)
        // } else {
        //     content = (<React.Fragment>
        //         <div className="admin-section-title">Enter password to move/delete file </div>
        //         <div className="admin-section-content">
        //             <input className="admin-intput" ref={pathInput => this.passwordInputRef = pathInput}
        //                 placeholder="...type here" onChange={this.setPasswordCookie.bind(this)} />
        //         </div>
        //     </React.Fragment>);
        // }

        // return (
        //     <div className="admin-section">
        //         {content}
        //     </div>
        // )
    }

    onclickShutDown() {
        Swal.fire({
            title: "Remote Shutdown",
            text: "Do you want to shut down your computer?",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                Sender.post('/api/shutdownServer', {}, res => {
                    //send another request  to check if shut down?
                    alert("Shutdown request is sent");
                });
            }
        });
    }

    renderRemoteShutDown() {
        // const { etc_config } = this.context;
        // if (clientUtil.isLocalHost() || !clientUtil.isAuthorized(etc_config)) {
        //     return;
        // }

        if(clientUtil.isLocalHost()){
            return;
        }

        return <button onClick={this.onclickShutDown.bind(this)}> Remote Shutdown PC </button>;
    }

    onClickIP(server_ip){
        clientUtil.CopyToClipboard(server_ip);

        toast('Copied to Clipboard', {
            className: "one-line-toast",
            position: "top-right",
            autoClose: 3 * 1000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true
          })
    }

    renderQRCode(){
        try{
            // https://www.npmjs.com/package/qrcode.react
            let data = sessionStorage.getItem('GeneralInfo');
            data = JSON.parse(data);
            if(data.server_ip){
                return (
                    <div className="admin-section">
                    <div className="admin-section-title" title="QR Code" > LAN Address</div>
                    <div className="admin-section-content">
                        <div className='ip-address-title'  
                             onClick={()=>this.onClickIP(data.server_ip)}>
                            {data.server_ip}
                            </div>
                        <QRCodeSVG value={data.server_ip} />
                    </div>
                    </div>
                )
            }
        }catch(e){
            console.error(e);
        }
    }

    rendersRightAsNext(){
        const options = [
            "Right As Next",
            "Left As Next"
        ]

        const checked = clientUtil.isRightAsNext()? 0: 1;
        const onHabitChange = (e, index)=>{
            const flg = index == 0;
            clientUtil.setRightAsNext(flg);
            this.askRerender();
        }

        return (
            <div className="admin-section">
            <div className="admin-section-title"> Reading Habit  </div>
            <div className="admin-section-content">
                <RadioButtonGroup checked={checked}
                    options={options} name="read habit" onChange={onHabitChange} />
            </div>
        </div>
        )
    }

    render() {
        document.title = "Admin"
        let folder_list = this.state.dirs.slice();
        folder_list.unshift("All_Pathes");

        return (
            <div className="admin-container container">
                {this.renderPasswordInput()}
                {this.rendersRightAsNext()}

                <div className="admin-section">
                    <div className="admin-section-title"> Pregenerate Thumbnail and Update Internal Database</div>
                    <div className="admin-section-content">
                        <RadioButtonGroup checked={folder_list.indexOf(this.state.prePath)}
                            options={folder_list} name="pregenerate" onChange={this.onPathChange.bind(this)} />
                        <input className="admin-intput" ref={pathInput => this.pathInputRef = pathInput} placeholder="...or any other path" />
                        <div className="submit-button" onClick={this.onPrenerate.bind(this, false)}>Full Update (Aslo Regenerate Metadata)</div>
                        <div className="submit-button" onClick={this.onPrenerate.bind(this, true)}>Fast Update (Only For New File)</div>
                    </div>
                </div>


                <CacheSection />
                {this.renderQRCode()}
                {this.renderRemoteShutDown()}
                <MinifyZipQueSection />
                <LogoutSection />

                <div className="author-link">
                    <a className="author-link-item" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank" rel="noreferrer">
                        <i className="fab fa-github author-link-icon" aria-hidden="true"></i>
                        <span className="author-link-text">Created By Aji47</span>
                    </a>
                </div>
            </div>)

    }
}

AdminPage.contextType = GlobalContext;