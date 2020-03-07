import React, { Component } from 'react';
import '../style/Checkbox.scss';

//default is 0

export default class Checkbox extends Component {
    static defaultProps = {
        
    };

    handleChange(){
        this.props.onChange();
    }

    render(){
        const {onChange, checked, children} = this.props;
        return   (<div className="aji-checkbox" onClick={this.handleChange.bind(this)}>
                    <input checked={!!checked}  onChange={()=>{}} onClick={this.handleChange.bind(this)} type="radio" />
                    <span className="inner"> {children}  </span>
                </div>);
        
    }
}


