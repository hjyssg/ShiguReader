
import '../style/Accordion.scss';
const util = require("@common_util");
import {Collapse} from 'react-collapse';
import React, { Component } from 'react';
var classNames = require('classnames');


export default class Accordion extends Component {
    static defaultProps = {
       
    }

    state = {
        open: false
    };

    toggleState(){
        this.setState({
            open: !this.state.open
        })
    }

    render(){
        const {className, header, body} = this.props;
        const cn = classNames("aji-accordion", className);

        return (
            <div className={cn} >
                <div className="aji-accordion-header btn btn-light" onClick={this.toggleState.bind(this)}> {header} </div>
                <Collapse isOpened={this.state.open}>
                    {body}
                </Collapse>
            </div>
        )
     }
}

Accordion.propTypes = {
 
};
