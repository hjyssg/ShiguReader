import React, { Component } from 'react';
import '../style/SortHeader.scss';
const classNames = require('classnames');


//default is 0

export default class SortHeader extends Component {
    static defaultProps = {
        
    };

    render(){
        const {options, onChange, value, className} = this.props;
        
        // <i class="fas fa-arrow-up"></i>
        // <i class="fas fa-sort-down"></i>
        const token = value.split("_");
        const key = token[0];
        const isUp = token[1] === "up";

        const items = options.map(e => {
            let icon;
            if(e === key){
                if(isUp){
                    icon = <i className="fas fa-arrow-up"></i>;
                }else{
                    icon = <i className="fas fa-arrow-down"></i>;
                }
            }
            const next = `${e}_${(isUp? "down": "up")}`;
            return (<div key={e} className="sort-item" onClick={()=>onChange(next)}> {icon} {e} </div>)
        })

        return (<div className="sort-header">{items}</div>)

    }
}


