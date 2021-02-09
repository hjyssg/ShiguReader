import React, { PureComponent } from 'react';
import '../style/SortHeader.scss';
const classNames = require('classnames');




export default class SortHeader extends PureComponent {
    static defaultProps = {

    };

    onClick(key){
        const { onChange, isSortAsc, selected } = this.props;
        let newSortOrder = !isSortAsc;
        if(key !== selected){
            newSortOrder = false;
        }
        onChange(key, newSortOrder);
    }

    render() {
        const { sortOptions, onChange, selected, isSortAsc, className } = this.props;

        const items = sortOptions.map(item => {
            let icon;
            if (item === selected) {
                if (isSortAsc) {
                    icon = <i className="fas fa-arrow-up"></i>;
                } else {
                    icon = <i className="fas fa-arrow-down"></i>;
                }
            }
            return (<div key={item} className="sort-item" onClick={() => this.onClick(item)}> {icon} {item} </div>)
        })

        return (<div className={classNames("sort-header", className)}>{items}</div>)

    }
}


