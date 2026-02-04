
import React, { Component, ReactNode } from 'react';
import '../Spinner/Spinner.scss';
import Spinner from '../Spinner';
import * as clientUtil from "@utils/clientUtil";
const { getDir, getBaseName } = clientUtil as any;

interface CenterSpinnerProps {
    text?: string;
    splitFilePath?: boolean;
}

export default class CenterSpinner extends Component<CenterSpinnerProps> {
    render(): ReactNode {
        let text: ReactNode = undefined;
        if (this.props.text) {
            if (this.props.splitFilePath) {
                text = <div className="title">
                    <div>{getBaseName(this.props.text)}</div>
                    <div>{getDir(this.props.text)}</div>
                </div>
            } else {
                text = <div className="title">{this.props.text}</div>
            }
        }

        return (
            <div className="loading-container">
                <div className="loading-inner">
                    <Spinner />
                    {text}
                    <div>is Loading</div>
                </div>
            </div>)
    }
}
