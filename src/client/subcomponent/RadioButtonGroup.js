import React, { Component } from 'react';
import '../style/RadioButtonGroup.scss';

//default is 0

export default class RadioButtonGroup extends Component {
    static defaultProps = {
        
    };

    render(){
        const {options, name, onChange, checked} = this.props;
        const buttons = options.map((e, index) => {
            return   (<div className="radio-button" key={e}  onClick={() => onChange(e)}>
                           <input checked={index === checked} onChange={()=>{}} onClick={onChange} type="radio" name={name} value={e} key={e}/> {e} 
                      </div>);
        })
        return <form action=""> {buttons} </form>;
    }
}


