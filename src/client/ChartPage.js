import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/ChartPage.scss';
import Sender from './Sender';
import _ from "underscore";
const nameParser = require('@name-parser');
const filesizeUitl = require('filesize');
import CenterSpinner from './subcomponent/CenterSpinner';
import ErrorPage from './ErrorPage';
import {Bar, Pie, Line} from 'react-chartjs-2';
const clientUtil = require("./clientUtil");
const {  getBaseName } = clientUtil;
const util = require("@common/util");
const {isCompress} = util;
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
const { isVideo } = util;
import Accordion from './subcomponent/Accordion';
const queryString = require('query-string');

const Constant = require("@common/constant");

const { MODE_TAG,
        MODE_AUTHOR,
        MODE_SEARCH,
        MODE_EXPLORER} = Constant;


const BY_YEAR = "by year";
const BY_QUARTER = "by quarter";

function parse(str){
    return nameParser.parse(getBaseName(str));
}

function getKeyAndValues(keyToValueTable){
    const keys = _.keys(keyToValueTable);
    keys.sort();
    const values = keys.map(e => keyToValueTable[e]);
    return {
        keys,
        values
    }
}

function renderTable(labels, values){
    const tableHeader = (<thead><tr>
        <th scope="col">name</th>
        <th scope="col">number</th>
        </tr></thead>);

        const rows = labels.map((e, index) => {
            return (<tr key={index}><th scope="row">{e}</th><td>{values[index]}</td></tr>);
        });

    return (
        <table className="table aji-table">
            {tableHeader}
            <tbody>
                {rows}
            </tbody>
        </table>
    );
}

export default class ChartPage extends Component {
    constructor(prop) {
        super(prop);
        this.failedTimes = 0;
        this.state = {fileType: "compressed", timeType: BY_YEAR};
    }

    componentDidMount() {
        if(this.failedTimes < 3) {
            Sender.post("/api/allInfo", {}, res => {
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

    getMode(props){
        const _props = props || this.props;
        const obj = queryString.parse(_props.location.search);

        if(obj.a){
            return MODE_AUTHOR;
        }else if(obj.p){
            return MODE_EXPLORER;
        }else if(obj.t){
            return MODE_TAG;
        }else if(obj.s){
            return MODE_SEARCH;
        }
    }

    getTextFromQuery(props) {
        //may allow tag author in future
        const _props = props || this.props;
        const obj = queryString.parse(_props.location.search);
        return obj.a || obj.p || obj.t || obj.s ||  "";
    }

    getFilterFiles(){
        const fileTypeFilter =  this.isShowingVideoChart()? isVideo : isCompress;
        const text = this.getTextFromQuery();
        const mode = this.getMode();
        const result = (this.files || []).filter(e => {
            if(!fileTypeFilter(e)){
                return false;
            }

            let result = true;
            // todo: this logic is similar to back end search
            // but not the same
            // should the same code 
            if(text){
                if(mode === MODE_EXPLORER){
                    result = e.startsWith(text);
                }else if(mode === MODE_AUTHOR){
                    const temp = parse(e);
                    result = temp && temp.author === text;
                }else if(mode === MODE_SEARCH){
                    result = e.includes(text);
                }else if(mode === MODE_TAG){
                    const temp = parse(e);
                    result = temp && temp.tags.includes(text);
                }
            }

            return result;
        });
        return result;
    }

    isShowingVideoChart(){
        return this.state.fileType === "video";
    }

    renderComiketChart(){
        if(this.isShowingVideoChart()){
            return;
        }

        const byComiket = _.countBy(this.getFilterFiles(), e=> {
            const result = parse(e);
            if(result && result.comiket){
                let cc = result.comiket;
                return cc.toUpperCase();
            }else {
                return "etc";
            }
        });

        const data = {};
        let {values, keys} =  getKeyAndValues(byComiket)


        const index = keys.indexOf("etc");
        keys.splice(index, 1);
        values.splice(index, 1)
        data.labels = keys;

        data.datasets = [{
            type: 'bar',
            label: 'by comiket',
            backgroundColor: "#15c69a",
            data:  values
          }]

        const opt = {
            maintainAspectRatio: false,
            legend: {
                position: "right"
            }
        };

        //add big tag
        return (
            <div className="individual-chart-container">
                <div>
                <Bar
                    data={data}
                    width={800}
                    height={200}
                    options={opt}
                />
                </div>
                <Accordion header="Toggle Table"  body={renderTable(data.labels, values)} />
            </div>
          );
    }

    rendeTimeChart(){
        const { timeType } = this.state;

        const byTime = _.countBy(this.getFilterFiles(), e=> {
            const fileInfo = this.fileToInfo[e];
            let aboutTimeA = nameParser.getDateFromParse(getBaseName(e));
            aboutTimeA = aboutTimeA && aboutTimeA.getTime();
            aboutTimeA = aboutTimeA || fileInfo.mtime;

            const t  = new Date(aboutTimeA);
            const month = t.getMonth();
            const quarter = Math.floor(month/3)+1;

            let tLabel = timeType === BY_QUARTER? `${t.getFullYear()}-Q${quarter} `: t.getFullYear();
            return tLabel;
        });

        const data = {};
        const {values, keys} =  getKeyAndValues(byTime)
        data.labels = keys;
        data.datasets = [{
            type: 'line',
            label: this.state.timeType,
            backgroundColor: "orange",
            fill: false,
            showLine: true,
            tension: 0,
            data:  values
          }];

        const TIME_OPITIONS = [BY_YEAR, BY_QUARTER]

          return (
            <div className="individual-chart-container">
             <RadioButtonGroup 
                            className="chart-radio-button-group"
                            checked={TIME_OPITIONS.indexOf(this.state.timeType)} 
                            options={TIME_OPITIONS} 
                            onChange={this.onTimeTypeChange.bind(this)}/>

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
        if(this.isShowingVideoChart()){
            return;
        }

        const byType  = _.countBy(this.getFilterFiles(), e=> {
            const result = parse(e);
            if(result &&  result.type){
                return result.type;
            }
            return "etc"
        });

        const data = {};
        const {values, keys} =  getKeyAndValues(byType)
        data.labels = keys;
        data.datasets = [{
            type: 'pie',
            label: 'by type',
            backgroundColor: ["aqua", "blue", "orange", "yellow","green", "lime", "pink"],
            data:  values
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

    renderTotalSize(){
        let total = 0;
        const files = this.getFilterFiles();
        const num = files.length;
        files.forEach(e => {
           total += this.fileToInfo[e].size;
        })
        return (<div className="total-info"> 
                     <div>{`There are ${num} ${this.state.fileType} files`}</div>
                     <div>{`Total: ${filesizeUitl(total, {base: 2})}`}</div>
                </div>)
    }

    renderGoodBadDistribution(){
        if(this.isShowingVideoChart()){
            return;
        }

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
            allAuthors = _.uniq(allAuthors);
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
            // console.log(value);

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
    
    onFileTypeChange(e){
        this.setState({
            fileType: e
        });
    }

    onTimeTypeChange(e){
        this.setState({
            timeType: e
        });
    }   


    render(){
        document.title = "Chart"
        const too_few = 30;

        const FILE_OPTIONS = [
          "video",
          "compressed"
        ];

        const files = this.getFilterFiles();
        const {fileType} = this.state;

        const filePath = <div>{this.getTextFromQuery() }</div>; 

        const radioGroup = <RadioButtonGroup 
                            className="chart-radio-button-group"
                            checked={FILE_OPTIONS.indexOf(this.state.fileType)} 
                            options={FILE_OPTIONS} 
                            onChange={this.onFileTypeChange.bind(this)}/>

        if (!this.res) {
            return (<CenterSpinner/>);
        } else if(this.isFailedLoading()) {
            return <ErrorPage res={this.res.res}/>;
        } else if(files.length < too_few){
            return ( <div className="chart-container container">
                        {filePath}
                        {radioGroup}
                        <div className="alert alert-info" role="alert" > 
                             <div>{`There are only ${files.length} ${fileType} files.`} </div> 
                             <div>Unable to render chart</div>
                        </div>
                    </div>);
        }else{ 
            return (
                <div className="chart-container container">
                    {filePath}
                    {radioGroup}
                    {this.renderTotalSize()}
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
