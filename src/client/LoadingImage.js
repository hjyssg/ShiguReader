import React, { Component } from 'react';
import PropTypes from 'prop-types';
import notAvailable from './images/not-available.png';
import Sender from './Sender';
const Constant = require("../constant");

export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      failed: 0
    };
  }

  componentDidMount() {
    if(this.props.isThumbnail){
      setTimeout(()=>{
        this.onChange(true)
      }, 200);
    }
  }

  componentWillUnmount(){
    this.isUnmounted = true;
  }

  onChange(isVisible){
    const {onChange, url} = this.props;

    if(isVisible){
      onChange && onChange();
    }

    if(isVisible && !this.state.url & !this.loading){
      if(url){
        this.setState({ url: url }); 
      } else {
        this.requestThumbnail()
      }
    }
  }

  requestThumbnail(){
    const { mode, fileName } = this.props;
    const api = (mode === "author" || mode === "tag") ? Constant.TAG_THUMBNAIL_PATH_API :  '/api/firstImage';
    const body = {};

    if(mode === "author" || mode === "tag"){
      body[mode] = fileName;
    }else{
      body["fileName"] = fileName;
    }

    this.loading = true;

    // fetch(api, {
    //   method: 'POST',
    //   headers: {
    //       Accept: 'application/json',
    //       'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(body)
    // })
    // .then((res) => {
    //   if(res.status === 200){
    //     return res.blob();
    //   }else{
    //     this.setState({ failed: true }); 
    //     return null;
    //   }
    // })
    // .then((res) => { 
    //   if(!this.isUnmounted && res){
    //     this.url = URL.createObjectURL(res);
    //     this.setState({ loaded: true }); 
    //   }
    // });

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

  Error(){
    if(!this.isTotalFailed()){
      this.setState({
        url: null,
        failed: this.state.failed+1
      }, ()=> {
        this.requestThumbnail()
      });
    }
  }

  isTotalFailed(){
    return this.state.failed > 2;
  }

  render() {
    let content;
    const {className, fileName, url, bottomOffet, topOffet, title, isThumbnail, onReceiveUrl, ...others} = this.props;
    const cn = "loading-image  " + className;

    if (this.isTotalFailed()) {
      content = (<img key={fileName} ref={e=>{this.dom = e && e.node}} className={cn} src={notAvailable} title={title || fileName} {...others}/>);
    } else if (this.state.url) {
      content = (<img key={fileName} ref={e=>{this.dom = e && e.node}} 
                      className={className} src={this.state.url} title={title || fileName} 
                      onError={this.Error.bind(this)} 
                      {...others}/>);
    } else {
      content = (<img key={fileName} className={cn}  title={title || fileName} {...others}/>);
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
