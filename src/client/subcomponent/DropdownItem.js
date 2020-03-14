import React, { Component } from 'react';

export default class DropdownItem extends Component {
    handleChange(){
        this.props.closeMenu && this.props.closeMenu();
        this.props.onClick && this.props.onClick();
    }

    render(){
        const { children} = this.props;
        return   (<div className="aji-dropdown-item" onClick={this.handleChange.bind(this)}>
                    {children}
                 </div>);
        
    }
}


