
import '@styles/Accordion.scss';
// const util = require("@common/util");
import { Collapse } from 'react-collapse';
import React, { useState } from 'react';
var classNames = require('classnames');

export default function Accordion(props) {
        const [ open, setOpen ] = useState(false);
        const { className, header, body } = props;
        const cn = classNames("aji-accordion", className);

        return (
            <div className={cn} >
                <div className="aji-accordion-header btn btn-light" onClick={() => { setOpen(!open) }}> {header} </div>
                <Collapse isOpened={open}>
                    {body}
                </Collapse>
            </div>
        )
}

