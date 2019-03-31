import React, { Component } from 'react';
import '../style/RadioButtonGroup.scss';

//default is 0

export default class RadioButtonGroup extends Component {
    static defaultProps = {
        defaultChecked: 0
    };

    render(){
        const {options, name, onChange, defaultChecked} = this.props;
        const buttons = options.map((e, index) => {
            return   (<div className="radio-button" key={e}>
                           <input defaultChecked={index === defaultChecked} onClick={onChange} onChange={onChange} type="radio" name={name} value={e} key={e}/> {e} 
                      </div>);
        })
        return <form action=""> {buttons} </form>;
    }
}


