
// const util = require("@common/util");
import React, { useState } from 'react';
var classNames = require('classnames');

export default function ItemsContainer(props) {
    const [ open, setOpen ] = useState(false);
    const { className, items, neverCollapse, noContainerPadding } = props;
    const TOO_MUCH = 15;

    if (neverCollapse || items.length <= TOO_MUCH) {
        return (
            <ul className={classNames(
                "item-container",
                { container: !noContainerPadding },
                className,
            )}>
                {items}
            </ul>);
    } else {
        const _items = open ? items : items.slice(0, TOO_MUCH);
        const cn = classNames("item-container-expand-button", className, {
        });

        const arrowCn = classNames("arror-icon", {
            "fas fa-arrow-down": !open,
            "fas fa-arrow-up": open,
        })

        return (
            <ul className={classNames(
                "item-container",
                { container: !noContainerPadding },
                className,
            )}>
                {_items}
                <div className={cn} onClick={() => { setOpen(!open) }} >
                    <span>...</span>
                    <i className={arrowCn} />
                </div>
            </ul>);
    }
}
