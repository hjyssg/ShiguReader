
const util = require("@common/util");
import React, { Component } from 'react';
var classNames = require('classnames');

export default class ItemsContainer extends Component {
    static defaultProps = {

    }

    state = {
        open: false
    };

    toggleState() {
        this.setState({
            open: !this.state.open
        })
    }

    render() {
        const { className, items, neverCollapse } = this.props;
        const { open } = this.state;
        const TOO_MUCH = 15;

        if (neverCollapse || items.length <= TOO_MUCH) {
            return (
                <ul className={classNames("dir-list container", className)}>
                    {items}
                </ul>);
        } else {
            const _items = open ? items : items.slice(0, TOO_MUCH);
            const cn = classNames("item-container-expand-button", className, {
                "fas fa-arrow-down": !open,
                "fas fa-arrow-up": open,
            });
            return (
                <ul className={"dir-list container"}>
                    {_items}
                    <div className={cn} onClick={this.toggleState.bind(this)} > </div>
                </ul>);
        }
    }
}
