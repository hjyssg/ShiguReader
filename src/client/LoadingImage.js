import React, { Component } from 'react';
import PropTypes from 'prop-types';
import loading from './images/loading.png';
import notAvailable from './images/not-available.png';
const VisibilitySensor = require('react-visibility-sensor').default;
import Sender from './Sender';
const Constant = require("../constant");

export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount() {
    if(this.props.isThumbnail){
      setTimeout(()=>{
        this.onChange(true)
      }, 2*1000);
    }
  }

  componentWillUnmount(){
    this.isUnmounted = true;
  }

  onChange(isVisible){
    const {onChange, url, mode, fileName} = this.props;

    if(isVisible){
      onChange && onChange();
    }

    if(isVisible && !this.state.loaded & !this.loading){
      if(url){
        this.setState({ url: url }); 
      } else {
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
            this.setState({ failed: true }); 
          }else{
            this.props.onReceiveUrl && this.props.onReceiveUrl(res.url);
            this.setState({ url: res.url }); 
          }
        });
      }
    }
  }

  render() {
    let content;
    const {className, fileName, url, bottomOffet, topOffet, title, isThumbnail, onGetUrl, ...others} = this.props;
    const cn = "loading-image  " + className;
    let active = true;
    if (this.state.failed) {
      content = (<img key={fileName} ref={e=>{this.dom = e && e.node}} className={cn} src={notAvailable} title={title || fileName} {...others}/>);
    } else if (!this.state.url) {
      content = (<img key={fileName} className={cn} src={loading} title={title || fileName} {...others}/>);
    } else if (this.state.url) {
      active = false;
      content = (<img key={fileName} className={className} src={this.state.url} title={title || fileName} {...others}/>);
    }

    return (
      <VisibilitySensor 
          active={active}
          key={fileName||url}
          offset={{bottom: bottomOffet || -200, top: topOffet || -200}} 
          onChange={this.onChange.bind(this)}>
        {content}
      </VisibilitySensor>
    );
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
