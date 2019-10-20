//@flow
import React, { Component } from 'react';
import '../style/ScrollZoomer.scss';
import classnames from 'classnames';

const minRate = 80;
const maxRate = 180;

const defaultZoomRate = Math.round(window.devicePixelRatio * 100);

export default class ScrollZoomer extends Component {
  constructor(props) {
    super(props);
    //https://stackoverflow.com/questions/1713771/how-to-detect-page-zoom-level-in-all-modern-browsers
    this.state = {
      rate: defaultZoomRate
    };
  }

  componentDidMount(){
    this.dom.addEventListener("wheel", this.onwheel.bind(this), {passive: false} );
  }

  changeZoomRate(newRate){
    newRate = Math.min(maxRate, newRate);
    newRate = Math.max(minRate, newRate);

    this.setState({
      rate: newRate
    });
    //https://stackoverflow.com/questions/9441557/how-to-increase-browser-zoom-level-on-page-load
    document.body.style.zoom = newRate + "%";
  }

  reset(){
    this.changeZoomRate(defaultZoomRate);
  }

  onClick(){
    this.changeZoomRate(100);
  }

  onwheel(e){
    e.preventDefault();

    const CHANGE_RATE = 5;
    const newRate = e.wheelDelta > 0?   this.state.rate + CHANGE_RATE : this.state.rate - CHANGE_RATE;
    this.changeZoomRate(newRate);
  }

  render(){
    return <div  className="scroll-zoomer" ref={ref => this.dom = ref} onClick={this.onClick.bind(this)}> {this.state.rate + "%"}  </div>;
  }
}