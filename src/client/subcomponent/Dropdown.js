import React, { Component } from 'react';
import '../style/Dropdown.scss';
const classNames = require('classnames');
const enhanceWithClickOutside = require('react-click-outside');

class Dropdown extends Component {
    static defaultProps = {
        
    };

    constructor(prop) {
        super(prop);
        this.state = { open: false };
    }

    toggleOpen(){
        this.setState({
            open: !this.state.open
        });
    }

    handleClickOutside(){
        this.setState({
            open: false
        });
    }

    render(){
        const { children} = this.props;
        const { open } = this.state;
        const cn = classNames("aji-dropdown", {
            "open" : open
        })

        return   (
        <div className={cn}  onBlur={this.handleClickOutside.bind(this)}>
            <div className="aji-dropdown-header fas fa-angle-right" onClick={this.toggleOpen.bind(this)} >  </div>
            <div className="aji-dropdown-menu">
                {React.Children.map(children, (child, index)=>{
                    return child && React.cloneElement(child, {
                        closeMenu: this.handleClickOutside.bind(this)
                    })
                })}
            </div>
        </div>);
    }
}


export default enhanceWithClickOutside(Dropdown);;
