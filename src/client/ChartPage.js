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
const { getDir, getFn } = clientUtil;


export default class ChartPage extends Component {
    constructor(prop) {
        super(prop);
        this.failedTimes = 0;
        this.state = {};
    }

    componentDidMount() {
        if(this.failedTimes < 3) {
            Sender.get("/api/allInfo", res => {
                this.handleRes(res);
            });

            Sender.get('/api/getGoodAuthorNames', res =>{
                this.setState({
                    goodAuthors: res.goodAuthors,
                    otherAuthors: res.otherAuthors
                })
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
            const result = nameParser.parse(getFn(e));
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
            const pA = nameParser.parse(getFn(e));
            let aboutTimeA = pA && nameParser.getDateFromTags(pA.tags);
            aboutTimeA = aboutTimeA && aboutTimeA.getTime();
            aboutTimeA = aboutTimeA || fileInfo.mtime;

            const t  = new Date(aboutTimeA);
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
            const result = nameParser.parse(getFn(e));
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
            if(isCompress(e)){
                total += this.fileToInfo[e].size;
                num++;
            }
        })
        return (<div className="total-info"> 
                     <div>{`There are ${num} files`}</div>
                     <div>{`Total: ${filesizeUitl(total, {base: 2})}`}</div>
                </div>)
    }

    renderGoodBadDistribution(){
        const {goodAuthors, otherAuthors} = this.state;

        const data = {
            labels : []
        };
        const segment = 0.05;

        for(let ii = 0; ii < 1/segment; ii++){
            data.labels.push((ii * segment));
        }

        if(goodAuthors && otherAuthors){
            let allAuthors = _.keys(goodAuthors).concat(_.keys(otherAuthors));
            allAuthors = array_unique(allAuthors);
            let value = [];

            allAuthors.forEach(aa => {
                const good = goodAuthors[aa] || 0;
                const other = otherAuthors[aa] || 0;
                let pp = good/(good+other);
                pp = pp.toFixed(2);

                for(let ii = 0; ii < data.labels.length; ii++){
                    const segmentBeg = data.labels[ii];
                    const segmentEnd = segmentBeg + segment;

                    if(segmentBeg <= pp && pp < segmentEnd ){
                        value[ii] = value[ii] || 0;
                        value[ii]++;
                        break;
                    }
                }
            });

            data.labels = data.labels.slice(1);
            value = value.slice(1);
            console.log(value);

            const opt = {
                maintainAspectRatio: false,
                legend: {
                    position: "right"
                }
            };

            data.datasets = [{
                type: 'line',
                label: 'good/(good+other) distribution',
                backgroundColor: "#15c69a",
                data:  value,
                fill: false,
              }]

            return (
                <div className="individual-chart-container">
                  <Line
                    data={data}
                    width={800}
                    height={200}
                    options={opt}
                  />
                </div>
              );
        }
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
                    {this.renderGoodBadDistribution()}
                </div>)
        }
    }
}

ChartPage.propTypes = {
    res: PropTypes.object
};
