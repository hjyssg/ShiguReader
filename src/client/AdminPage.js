import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/AdminPage.scss';
import Sender from './Sender';
const userConfig = require('../user-config');
// import _ from "underscore";
// const util = require("../util");
// const nameParser = require('../name-parser');
// const filesizeUitl = require('filesize');
// import CenterSpinner from './subcomponent/CenterSpinner';
// import ErrorPage from './ErrorPage';
import Swal from 'sweetalert2';
import RadioButtonGroup from './subcomponent/RadioButtonGroup';

export default class AdminPage extends Component {
    constructor(prop) {
        super(prop);
        this.state = { prePath : userConfig.folder_list[0] };
    }

    onPrenerate(){
        Swal.fire({
            title: "Pregenerate Thumbnail",
            text: this.state.prePath ,
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                const reqB = {
                    path: this.state.prePath
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

    cleanCache(){
        Swal.fire({
            title: "Clean Cache",
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.value === true) {
                const req = {
                    path: this.state.prePath
                }
                Sender.get('/api/cleanCache', req, res =>{
                    console.log(res)
                });
            } 
        });
    }

    render(){
        document.title = "Admin"

        return (
            <div className="admin-container container">
                <div className="admin-section">
                    <div className="admin-section-title"> Pregenerate Thumbnail</div>
                    <div className="admin-section-content">
                        <RadioButtonGroup checked={userConfig.folder_list.indexOf(this.state.prePath)} options={userConfig.folder_list} name="pregenerate" onChange={this.onPathChange.bind(this)}/>
                        <div className="submit" onClick={this.onPrenerate.bind(this)}>Submit</div>
                    </div>
                </div>

                <div className="admin-section">
                    <div className="admin-section-title"> Clean Cache</div>
                    <div className="admin-section-content">
                        <div className="submit" onClick={this.cleanCache.bind(this)}>Submit</div>
                    </div>
                </div>

                <div className="author-link"> 
                        <a className="fab fa-github" title="Aji47's Github" href="https://github.com/hjyssg/ShiguReader" target="_blank"> Created By Aji47 </a> 
                </div>
            </div>)
        
    }
}

AdminPage.propTypes = {
    res: PropTypes.object
};
