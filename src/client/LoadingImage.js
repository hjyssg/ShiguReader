import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Sender from './Sender';
const Constant = require("../constant");
const classNames = require('classnames');

export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      failed: 0,
      url: props.url
    };
  }

  componentDidMount() {
    if(this.props.isThumbnail){
      setTimeout(()=>{
        this.onChange(true)
      }, 0);
    }
  }

  componentWillUnmount(){
    this.isUnmounted = true;
  }

  shouldAskUrl(){
    if(!this.state.url){
      return true
    }else{
      if(this.state.url === "NOT_THUMBNAIL_AVAILABLE"){
        return false;
      }else{
        return false;
      }
    }
  }

  onChange(){
    if(this.shouldAskUrl() & !this.loading){
        this.requestThumbnail()
    }
  }

  requestThumbnail(){
    const { mode, fileName } = this.props;
    const api = (mode === "author" || mode === "tag") ? Constant.TAG_THUMBNAIL_PATH_API :  '/api/firstImage';
    const body = {};

    if(mode === "author" || mode === "tag"){
      body[mode] = fileName;
    }else{
      body["filePath"] = fileName;
    }

    this.loading = true;
    Sender.post(api, body, res => {
      if(this.isUnmounted){
        return;
      }
      if (res.failed) {
        this.setState({ failed: this.state.failed+1 }); 
      }else{
        this.props.onReceiveUrl && this.props.onReceiveUrl(res.url);
        this.setState({ url: res.url }); 
      }
    });
  }

  onError(){
    if(!this.tryEnoughRequest()){
      this.setState({
        url: null,
        failed: this.state.failed+1
      }, ()=> {
        this.requestThumbnail()
      });
    }
  }

  tryEnoughRequest(){
    return this.state.failed > 2;
  }

  isThumbnailAvaible(){
    return this.state.url && this.state.url !== "NOT_THUMBNAIL_AVAILABLE";
  }

  render() {
    let content;
    const {className, fileName, url, bottomOffet, topOffet, title, isThumbnail, onReceiveUrl, ...others} = this.props;
    const cn = classNames("loading-image", className,{
      "empty-block fas fa-file-archive": !this.isThumbnailAvaible()
    });

   if (this.isThumbnailAvaible()) {
      content = (<img key={fileName} ref={e=>{this.dom = e && e.node}} 
                      className={className} src={this.state.url} title={title || fileName} 
                      onError={this.onError.bind(this)} 
                      {...others}/>);
    } else {
      content = (<div key={fileName} className={cn}  title={title || fileName} {...others}/>);
    }

    return content;
  }
}

LoadingImage.propTypes = {
  fileName: PropTypes.string,
  className: PropTypes.string,
  mode: PropTypes.string,
  url: PropTypes.string,   //predefined url, not request from this component,
  bottomOffet: PropTypes.number,
  topOffet: PropTypes.number,
  onChange: PropTypes.func
};
