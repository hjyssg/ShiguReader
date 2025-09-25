import React, { Component } from 'react';
import '../style/ThumbnailPopup.scss';
const classNames = require('classnames');
const _ = require("underscore");
const util = require("@common/util");
const clientUtil = require("../clientUtil");
const { isVideo } = util;
import Sender from '../Sender';

class ThumbnailPopup extends Component {
    static defaultProps = {

    };

    constructor(prop) {
        super(prop);
        this.url = prop.url;
        this.isHovering = false;
        this.state = {
            popupPosition: null,
            rerenderTick: false
        };
        this.useVideoPreviewForFolder = false;
        this.popupRef = React.createRef();
        this.popupDimensions = {
            width: 240,
            height: 220
        };
        this.lastMousePosition = null;

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
        if (this.popupRef.current && this.isHovering) {
            const rect = this.popupRef.current.getBoundingClientRect();
            const width = Math.round(rect.width);
            const height = Math.round(rect.height);
            if (width && height && (width !== this.popupDimensions.width || height !== this.popupDimensions.height)) {
                this.popupDimensions = { width, height };
                if (this.lastMousePosition) {
                    this.updatePopupPosition(this.lastMousePosition.x, this.lastMousePosition.y, false);
                }
            }
        }
      }

    askRerender(){
        this.setState((prevState) => ({
            rerenderTick: !prevState.rerenderTick
        }))
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

    updatePopupPosition(clientX, clientY, rememberMouse = true) {
        if (rememberMouse) {
            this.lastMousePosition = { x: clientX, y: clientY };
        }
        const offset = 12;
        const contentWidth = this.popupDimensions.width || 240;
        const contentHeight = this.popupDimensions.height || 220;
        let left = clientX - contentWidth - offset;
        if(left < offset){
            left = clientX + offset;
        }
        let top = clientY - contentHeight / 2;
        const minTop = offset;
        const maxTop = window.innerHeight - contentHeight - offset;
        if(top < minTop){
            top = minTop;
        }
        if(top > maxTop){
            top = maxTop;
        }
        const { popupPosition } = this.state;
        if (popupPosition && popupPosition.top === top && popupPosition.left === left) {
            return;
        }
        this.setState({
            popupPosition: {
                top,
                left
            }
        });
    }

    onMouseMove(e){
        this.isHovering = true;
        this.throttleGet();
        if(!e){
            this.askRerender();
            return;
        }
        const { clientX, clientY } = e;
        this.updatePopupPosition(clientX, clientY);
    }

    onMouseOut(){
        this.isHovering = false;
        this.setState({
            popupPosition: null
        });
        this.lastMousePosition = null;
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
        const popupStyle = this.state.popupPosition ? {
            top: this.state.popupPosition.top,
            left: this.state.popupPosition.left
        } : null;

        if(this.isHovering){
            if(isVideo(filePath)|| (this.useVideoPreviewForFolder && this.url)){
                let src;
                if(isVideo(filePath)){
                    src = clientUtil.getFileUrl(filePath);
                }else{
                    src = this.url;
                }

                extraDom = (<div className='thumbnail-popup-content' style={popupStyle} ref={this.popupRef}>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                    <video className={"thumbnail-video-preview"} src={src} autoPlay={true} muted>
                        Your browser does not support the video tag.
                    </video>
                </div>)

            } else if(url){
                extraDom = (<div className='thumbnail-popup-content' style={popupStyle} ref={this.popupRef}>
                <div className='thumbnail-popup-title'>{titleStr}</div>
                <img className='thumbnail-popup-img' src={url}></img>
                </div>)
            }else{
                extraDom = (<div className='thumbnail-popup-content' style={popupStyle} ref={this.popupRef}>
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
