import React, { Component } from 'react';
import _ from "underscore";
import PropTypes from 'prop-types';
import loading from './images/loading.png';
import notAvailable from './images/not-available.png';
import Sender from './Sender';
// const VisibilitySensor = require('react-visibility-sensor').default;

const VisibilitySensor = require('react-visibility-sensor').default;

export default class LoadingImage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false
    };
  }

  componentDidMount() {
    
  }

  componentWillUnmount(){
    this.isUnmounted = true;
  }

  onChange(isVisible){
    if(isVisible && !this.state.loaded & !this.loading){
      const {mode} = this.props;
      const api = (mode === "author" || mode === "tag") ? "/api/tagFirstImagePath" :  '/api/firstImage';
      const body = {};

      if(mode === "author" || mode === "tag"){
        body[mode] = this.props.fileName;
      }else{
        body["fileName"] = this.props.fileName;
      }

      this.loading = true;

      Sender.post(api, body,
        (res) => { !this.isUnmounted && this.setState({ loaded: true, ...res }); }
      );
    }
  }

  render() {
    let content;
    const {className} = this.props;
    const cn = "loading-image  " + className;
    if (this.state.failed) {
      content = (<img ref={e=>{this.dom = e && e.node}} className={cn} src={notAvailable}/>);
    } else if (this.state.loaded === false) {
      content = (<img className={cn} src={loading} />);
    } else {
      content = (<img className={className} src={"../" + this.state.image}/>);
    }

    return (
      <VisibilitySensor offset={{bottom:-1000}} onChange={this.onChange.bind(this)}>
        {content}
      </VisibilitySensor>
    );
  }
}

LoadingImage.propTypes = {
  fileName: PropTypes.string,
  className: PropTypes.string,
  mode: PropTypes.string,
};
