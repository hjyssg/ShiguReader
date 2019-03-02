import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/ChartPage.scss';
import Sender from './Sender';
import _ from "underscore";
const util = require("../util");
const nameParser = require('../name-parser');
const filesizeUitl = require('filesize');
import CenterSpinner from './subcomponent/CenterSpinner';
import ErrorPage from './ErrorPage';
import {Bar} from 'react-chartjs-2';

export default class ChartPage extends Component {
    constructor(prop) {
        super(prop);
        this.failedTimes = 0;
    }

    componentDidMount() {
        if(this.failedTimes < 3) {
            Sender.post("/api/allInfo", {}, res => {
                this.handleRes(res);
            });
        }
    }

    handleRes(res){
        if (!res.failed) {
            let { fileToInfo } = res;
            this.fileToInfo = fileToInfo || {};
            this.files = _.keys(this.fileToInfo) || [];
        }else{
            this.failedTimes++;
        }
        this.res = res;
        this.forceUpdate();
    }

    isFailedLoading(){
        return this.res && this.res.failed;
    }

    renderComiketChart(){
        const byComiket = {}; //c91 -> 350
        const tagByComiket = {}; // c95 -> kankore -> 201
        this.files.forEach(e => {
            const result = nameParser.parse(util.getFn(e));
            if(result && result.comiket){
                let cc = result.comiket;
                byComiket[cc] = byComiket[cc] || 0;
                byComiket[cc]++;

                tagByComiket[cc] = tagByComiket[cc] || {};
                result.tags.forEach(tag => {
                    if(tag !== cc && tag !== "同人誌"){
                        tagByComiket[cc][tag] = tagByComiket[cc][tag] || 0;
                        tagByComiket[cc][tag]++;
                    }
                })
            }
        })

        const data = {};
        data.labels = nameParser.comiketTags;
        const value = [];
        nameParser.comiketTags.forEach(e => {
            value.push(byComiket[e]);
        })

        data.datasets = [{
            type: 'bar',
            label: 'by comiket',
            backgroundColor: "#15c69a",
            data:  value
          }]

        // console.log(tagByComiket);
        // console.table(tagByComiket);

        const opt = {
            maintainAspectRatio: false,
            // scales: {
            //   xAxes: [{
            //     stacked: true
            //   }],
            //   yAxes: [{
            //     stacked: true
            //   }]
            // }
          };

        return (
            <div className="individual-chart-container">
              <Bar
                data={data}
                width={800}
                height={200}
                options={opt}
              />
            </div>
          );
    }

    getTotalSize(){
        let total = 0;
        let num = 0;
        this.files.forEach(e => {
            if(util.isCompress(e)){
                total += this.fileToInfo[e].size;
                num++;
            }
        })
        return  `${num} files: ${filesizeUitl(total, {base: 2})}`
    }

    render(){
        if (!this.res) {
            return (<CenterSpinner/>);
        } else if(this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        } else if(this.files.length <100){
            return (<div>Too few file </div>)
        }else{
            
            return (
                <div className="chart-container container">
                    <div className="total-info"> {this.getTotalSize()} </div>
                    {this.renderComiketChart()}
                </div>)
        }
    }
}

ChartPage.propTypes = {
    res: PropTypes.object
};
