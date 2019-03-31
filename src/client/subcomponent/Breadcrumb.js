import React, { Component } from 'react';
import '../style/Breadcrumb.scss';
import { Link } from 'react-router-dom';
const util = require("../../util");
const stringHash = util.stringHash;

export default class Breadcrumb extends Component {
    render(){
        const {path, right} = this.props;
        // return "At " + this.path;
        const pathes = path.split("\\");
        const pathList = [];
        //https://www.w3schools.com/howto/howto_css_breadcrumbs.asp
        for(let ii =0; ii < pathes.length; ii++){
            let item = pathes.slice(0, ii+1).join("\\");
            if(ii === pathes.length -1){
                //last one not link
                pathList.push(<div key={item} className={"breadcrumb-item current"}>{pathes[ii]} </div>);
            }else{
                const pathHash = stringHash(item);
                const toUrl =('/explorer/'+ pathHash);
                pathList.push(<Link to={toUrl}  key={item} className={"breadcrumb-item"}>{pathes[ii]}</Link>);
            }
        }

        


        return   (<ul className="explorer-breadcrumb">{pathList}{right}</ul>);
    }
}


