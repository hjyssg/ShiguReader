import React, { Component } from 'react';
import '../style/Breadcrumb.scss';
import { Link } from 'react-router-dom';
const classNames = require('classnames');
const clientUtil = require("../clientUtil");
import { toast } from 'react-toastify';

export default class Breadcrumb extends Component {
    onClickPath(){
        let { path } = this.props;
        clientUtil.CopyToClipboard(path);

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

    render() {
        let { path, right, className, sep, server_os} = this.props;
        console.assert(sep);
        sep = sep || "\\";
        const beginWithSep = path.startsWith(sep);
        let pathes = path.split(sep).filter(e => !!e);
        const isLinux = server_os === "linux";
  
        const pathList = [];
        //https://www.w3schools.com/howto/howto_css_breadcrumbs.asp
        for (let ii = 0; ii < pathes.length; ii++) {
            let item = pathes.slice(0, ii + 1).join(sep);
            if(beginWithSep){
                item = sep + item;
            }
            if (ii === pathes.length - 1) {
                //last one not link
                pathList.push(<div key={item} className={"breadcrumb-item current"} onClick={this.onClickPath.bind(this)}>{pathes[ii]} </div>);
            } else {
                const toUrl = clientUtil.getExplorerLink(item);
                pathList.push(<Link to={toUrl} key={item} className={"breadcrumb-item"}>{pathes[ii]}</Link>);
                pathList.push(<div key={ii + "sep"} className="breadcrumb-sep" >{sep}</div>)
            }
        }

        if(isLinux){
            const toUrl = clientUtil.getExplorerLink("/");
            pathList.unshift(<div key={"root sep"} className="breadcrumb-sep" >{sep}</div>)
            pathList.unshift(<Link to={toUrl} key={"root"} className={"breadcrumb-item"}>root</Link>);
        }

        const cn = classNames("explorer-breadcrumb", className);
        return (<ul className={cn}>{pathList}{right}</ul>);
    }
}


