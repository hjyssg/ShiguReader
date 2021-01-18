import React, { PureComponent } from 'react';
import '../style/SortHeader.scss';
const classNames = require('classnames');


//default is 0
function parse(value){
    const token = value.split("_");
    const key = token[0];
    const isUp = token[1] === "up";

    return {
        key,
        isUp
    }
}

export default class SortHeader extends PureComponent {
    static defaultProps = {

    };

    onClick(option, previousValue){
        const { onChange } = this.props;

        const { key, isUp } = parse(previousValue);
        let next = `${option}_${(isUp ? "down" : "up")}`;
        if(key !== option){
            next = `${option}_down`;
        }else{
            next = `${option}_${(isUp ? "down" : "up")}`;
        }
        onChange(next);
    }

    render() {
        const { options, onChange, value, className } = this.props;

        // <i class="fas fa-arrow-up"></i>
        // <i class="fas fa-sort-down"></i>
        const { key, isUp } = parse(value);

        const items = options.map(e => {
            let icon;
            if (e === key) {
                if (isUp) {
                    icon = <i className="fas fa-arrow-up"></i>;
                } else {
                    icon = <i className="fas fa-arrow-down"></i>;
                }
            }
            return (<div key={e} className="sort-item" onClick={() => this.onClick(e, value)}> {icon} {e} </div>)
        })

        return (<div className={classNames("sort-header", className)}>{items}</div>)

    }
}


