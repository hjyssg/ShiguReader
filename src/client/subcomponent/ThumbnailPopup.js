import React, { Component } from 'react';
import '../style/ThumbnailPopup.scss';
const classNames = require('classnames');
const _ = require("underscore");
const util = require("@common/util");
const clientUtil = require("../clientUtil");
const { isCompress } = util;
import Sender from '../Sender';

class ThumbnailPopup extends Component {
    static defaultProps = {

    };

    constructor(prop) {
        super(prop);
        this.url = prop.url;
        this.isHovering = false;
        this.state = {};

        // a throttled function that can only call the func parameter maximally once per every wait milliseconds. 
        this.throttleGet = _.throttle(()=> {
            this.fetchData();
        }, 1000);
    }

    componentDidUpdate(prevProps) {
        if (this.props.url && prevProps.url !== this.props.url && !this.state.url) {
          this.setState({
            url: this.props.url
          });
        }
      }

    askRerender(){
        this.setState({
            rerenderTick: !this.state.rerenderTick
        })
    }

    async fetchData ()  {
        const { filePath} = this.props;
        if(!this.url){
            const api = clientUtil.getQuickThumbUrl(filePath);
            const res = await Sender.getWithPromise(api);
            if (res.isFailed() || !res.json.url) {
                // todo
                // nothing 
            } else {
                this.url = clientUtil.getFileUrl(res.json.url);
            }
            this.askRerender();
        } 
    }

    onMouseMove(){
        this.isHovering = true;
        this.throttleGet();
        this.askRerender();
    }

    onMouseOut(){
        this.isHovering = false;
        this.askRerender();
    }

    render() {
        const { children, filePath, FileName } = this.props;
        const { isHovering, url } = this;
        const cn = classNames("thumbnail-popup-wrap", {
            "open": isHovering
        })

        let imgDom = null;
        if(this.isHovering){
            if(url){
                imgDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{filePath}</div>
                 <img className='thumbnail-popup-img' src={url}></img>
                  </div>)
            }else{
                imgDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{filePath}</div>
                <div className='thumbnail-popup-text'>NO_THUMBNAIL_AVAILABLE</div>
             </div>)
            }
        }

        return (
            <div className={cn}  onMouseMove={this.onMouseMove.bind(this)} onMouseOut={this.onMouseOut.bind(this)}>
                {children}
                {imgDom}
            </div>);
    }
}


export default ThumbnailPopup;