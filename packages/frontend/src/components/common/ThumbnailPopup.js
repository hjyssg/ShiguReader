import React, { Component } from 'react';
import '@styles/ThumbnailPopup.scss';
const classNames = require('classnames');
const _ = require("underscore");
const util = require("@common/util");
const clientUtil = require("@utils/clientUtil");
const { isVideo } = util;
import Sender from '@services/Sender';

class ThumbnailPopup extends Component {
    static defaultProps = {

    };

    constructor(prop) {
        super(prop);
        this.url = prop.url;
        this.isHovering = false;
        this.state = {};
        this.useVideoPreviewForFolder = false;

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
        if(isVideo(filePath)){
            return;
        }

        if(!this.url){
            const api = clientUtil.getQuickThumbUrl(filePath);
            const res = await Sender.getWithPromise(api);
            if (res.isFailed() || !res.json.url) {
                // todo
                // nothing 
            } else {
                this.url = clientUtil.getFileUrl(res.json.url);
                this.useVideoPreviewForFolder = res.json.useVideoPreviewForFolder;
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

        let extraDom = null;
        let titleStr = clientUtil.getBaseName(filePath);
        titleStr = util.truncateString(titleStr, 35);
        if(this.isHovering){
            if(isVideo(filePath)|| (this.useVideoPreviewForFolder && this.url)){
                let src;
                if(isVideo(filePath)){
                    src = clientUtil.getFileUrl(filePath);
                }else{
                    src = this.url;
                }

                extraDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                    <video className={"thumbnail-video-preview"} src={src} autoPlay={true} muted>
                        Your browser does not support the video tag.
                    </video>
                </div>)

            } else if(url){
                extraDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                <img className='thumbnail-popup-img' src={url}></img>
                </div>)
            }else{
                extraDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                <div className='thumbnail-popup-text'>NO_THUMBNAIL_AVAILABLE</div>
             </div>)
            }
        }

        return (
            <div className={cn}  onMouseMove={this.onMouseMove.bind(this)} onMouseOut={this.onMouseOut.bind(this)}>
                {children}
                {extraDom}
            </div>);
    }
}


export default ThumbnailPopup;
