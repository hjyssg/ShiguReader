import React, { Component } from 'react';
import './ThumbnailPopup.scss';
const classNames = require('classnames');
const _ = require("underscore");
const util = require("@common/util");
const clientUtil = require("@utils/clientUtil");
const { isVideo } = util;
import { getQuickThumbnail } from '@api/thumbnail';

class ThumbnailPopup extends Component {
    static defaultProps = {

    };

    constructor(prop) {
        super(prop);
        this.url = prop.url;
        this.isHovering = false;
        this.state = {};
        this.useVideoPreviewForFolder = false;
        this.hasFetchedThumbnail = !!prop.url;
        this.fetching = false;

        // a throttled function that can only call the func parameter maximally once per every wait milliseconds. 
        this.throttleGet = _.throttle(()=> {
            this.fetchData();
        }, 1000);
    }

    componentDidUpdate(prevProps) {
        if (this.props.url && prevProps.url !== this.props.url && !this.state.url) {
            this.url = this.props.url;
            this.hasFetchedThumbnail = true;
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
        if (!filePath || this.hasFetchedThumbnail || this.fetching) {
            return;
        }

        this.fetching = true;
        try {
            const res = await getQuickThumbnail(filePath);
            this.useVideoPreviewForFolder = !!(res.json && res.json.useVideoPreviewForFolder);
            if (!res.isFailed() && res.json && res.json.url) {
                this.url = clientUtil.getFileUrl(res.json.url);
            } else {
                this.url = null;
            }
            this.hasFetchedThumbnail = true;
        } catch (e) {
            this.fetching = false;
            return;
        }
        this.fetching = false;
        this.askRerender();
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
        const isHovering = this.isHovering;
        const previewUrl = this.url;
        const cn = classNames("thumbnail-popup-wrap", {
            "open": isHovering
        })

        let extraDom = null;
        let titleStr = clientUtil.getBaseName(filePath);
        titleStr = util.truncateString(titleStr, 35);
        if(this.isHovering){
            if(isVideo(filePath)){
                const fallbackSrc = clientUtil.getFileUrl(filePath);
                extraDom = (<div className='thumbnail-popup-content'>
                    <div className='thumbnail-popup-title'>{titleStr}</div>
                    {previewUrl ? (
                        <img className='thumbnail-popup-img' src={previewUrl}></img>
                    ) : (
                        <video className={'thumbnail-video-preview'} src={fallbackSrc} autoPlay={true} muted loop>
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>)

            } else if(this.useVideoPreviewForFolder && previewUrl){
                extraDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                    <video className={"thumbnail-video-preview"} src={previewUrl} autoPlay={true} muted>
                        Your browser does not support the video tag.
                    </video>
                </div>)

            } else if(previewUrl){
                extraDom = (<div className='thumbnail-popup-content'>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                <img className='thumbnail-popup-img' src={previewUrl}></img>
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
