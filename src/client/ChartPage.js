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
import {Bar, Pie, Line} from 'react-chartjs-2';

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
        data.labels = nameParser.ALL_COMIC_TAGS;
        const value = [];
        nameParser.ALL_COMIC_TAGS.forEach(e => {
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
            legend: {
                position: "right"
            }
            // scales: {
            //   xAxes: [{
            //     stacked: true
            //   }],
            //   yAxes: [{
            //     stacked: true
            //   }]
            // }
          };

        //add big tag

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

    rendeTimeChart(){
        const byTime = {}; //time -> 300. 
        this.files.forEach(e => {
            const fileInfo = this.fileToInfo[e];
            const t  = new Date(fileInfo.mtime);
            const tLabel = t.getFullYear();
            byTime[tLabel] = byTime[tLabel] || 0;
            byTime[tLabel]++;
        });

        const data = {};
        data.labels = _.keys(byTime);
        const value = _.values(byTime);

        data.datasets = [{
            type: 'line',
            label: 'by year',
            backgroundColor: "orange",
            fill: false,
            showLine: true,
            tension: 0,
            data:  value
          }];

          return (
            <div className="individual-chart-container">
              <Line
                className="type-time-chart"
                data={data}
                width={800}
                height={200}
                options={{
                    maintainAspectRatio: false,
                    legend: {
                        position: "right"
                    }
                }}
              />
            </div>
          );
    }

    renderPieChart(){
        const byType = {}; //doujin -> 300. 
        this.files.forEach(e => {
            const result = nameParser.parse(util.getFn(e));
            if(result &&  result.type){
                const type = result.type;
                byType[type] = byType[type] || 0;
                byType[type]++;
            }
        });

        const data = {};
        data.labels = _.keys(byType);
        const value = _.values(byType);

        data.datasets = [{
            type: 'pie',
            label: 'by type',
            backgroundColor: ["aqua", "blue", "orange", "yellow","green", "lime", "pink"],
            data:  value
          }];

          return (
            <div className="individual-chart-container">
              <Pie
                className="type-pie-chart"
                data={data}
                width={300}
                height={300}
                options={{
                    maintainAspectRatio: false,
                    legend: {
                        position: "right"
                    }
                }}
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
        return (<div className="total-info"> 
                     <div>{`There are ${num} files`}</div>
                     <div>{`Total: ${filesizeUitl(total, {base: 2})}`}</div>
                </div>)
    }

    render(){
        document.title = "Chart"

        if (!this.res) {
            return (<CenterSpinner/>);
        } else if(this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        } else if(this.files.length <100){
            return (<div>Too few file </div>)
        }else{
            
            return (
                <div className="chart-container container">
                    {this.getTotalSize()}
                    {this.rendeTimeChart()}
                    {this.renderComiketChart()}
                    {this.renderPieChart()}
                </div>)
        }
    }
}

ChartPage.propTypes = {
    res: PropTypes.object
};
