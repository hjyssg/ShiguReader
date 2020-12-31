import React, { Component } from 'react';
import PropTypes from 'prop-types';
import './style/ChartPage.scss';
import Sender from './Sender';
import _ from "underscore";
const nameParser = require('@name-parser');
import CenterSpinner from './subcomponent/CenterSpinner';
import ErrorPage from './ErrorPage';
import { Bar, Pie, Line } from 'react-chartjs-2';
const clientUtil = require("./clientUtil");
const { getBaseName } = clientUtil;
const util = require("@common/util");
const { isCompress } = util;
import RadioButtonGroup from './subcomponent/RadioButtonGroup';
const { isVideo } = util;
import Accordion from './subcomponent/Accordion';
const queryString = require('query-string');

const Constant = require("@common/constant");

const { MODE_TAG,
    MODE_AUTHOR,
    MODE_SEARCH,
    MODE_EXPLORER } = Constant;


const BY_YEAR = "by year";
const BY_QUARTER = "by quarter";
const BY_MONTH = "by month";
const BY_DAY = "by day";

function parse(str) {
    return nameParser.parse(getBaseName(str));
}

//@param filterFunction(key, value)
function getKeyAndValues(keyToValueTable, filterFunction) {
    const tempKeys = _.keys(keyToValueTable);
    tempKeys.sort();
    const values = [];
    let keys = [];
    tempKeys.forEach(key => {
        const value = keyToValueTable[key];

        if(filterFunction && !filterFunction(key, value)){
            return;
        }
        values.push(value);
        keys.push(key);
    })

    return {
        keys,
        values
    }
}

function renderTable(labels, values) {
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

const VALUE_COUNT = "value: count";
const VALUE_FILESIZE = "value: file size in MB";

const BY_MTIME = "by mtime";
const BY_TAG_TIME = "by tag time";



export default class ChartPage extends Component {
    constructor(prop) {
        super(prop);
        this.failedTimes = 0;
        this.state = {
            fileType: "compressed",
            timeType: BY_YEAR,
            timeSourceType: BY_TAG_TIME,
            valueType: VALUE_COUNT
        };
    }

    componentDidMount() {
        if (this.failedTimes < 3) {
            let api;
            let body;
            const mode = this.getMode();
            if (mode === MODE_EXPLORER) {
                api = '/api/lsDir';
                body = {
                    dir: this.getTextFromQuery(),
                    isRecursive: this.isRecursive()
                }
            } else if (mode) {
                api = "/api/search";
                body = {
                    text: this.getTextFromQuery(),
                    mode: mode
                }
            } else {
                api = "/api/allInfo";
                body = {};
            }

            Sender.post(api, body, res => {
                this.handleRes(res);
            });

            // Sender.post('/api/getGoodAuthorNames', {}, res => {
            //     if (!res.isFailed()) {
            //         this.setState({
            //             goodAuthors: res.json.goodAuthors,
            //             otherAuthors: res.json.otherAuthors
            //         })
            //     }
            // });
        }
    }

    handleRes(res) {
        if (!res.isFailed()) {
            let { fileToInfo, fileInfos } = res.json;
            this.fileToInfo = fileInfos || fileToInfo || {};
            this.files = _.keys(this.fileToInfo) || [];
        } else {
            this.failedTimes++;
        }
        this.res = res;
        this.forceUpdate();
    }

    isFailedLoading() {
        return this.res && this.res.isFailed();
    }

    getMode(props) {
        const _props = props || this.props;
        const obj = queryString.parse(_props.location.search);

        if (obj.a) {
            return MODE_AUTHOR;
        } else if (obj.p) {
            return MODE_EXPLORER;
        } else if (obj.t) {
            return MODE_TAG;
        } else if (obj.s) {
            return MODE_SEARCH;
        }
    }

    getTextFromQuery(props) {
        //may allow tag author in future
        const _props = props || this.props;
        const obj = queryString.parse(_props.location.search);
        return obj.a || obj.p || obj.t || obj.s || "";
    }

    isRecursive(props) {
        //may allow tag author in future
        const _props = props || this.props;
        const obj = queryString.parse(_props.location.search);
        return obj.isRecursive;
    }

    getFilterFiles() {
        const fileTypeFilter = this.isShowingVideoChart() ? isVideo : isCompress;
        const result = (this.files || []).filter(e => {
            return fileTypeFilter(e);
        });
        return result;
    }

    isShowingVideoChart() {
        return this.state.fileType === "video";
    }

    renderComiketChart(filtererFiles) {
        if (this.isShowingVideoChart()) {
            return;
        }

        const byComiket = _.countBy(filtererFiles, e => {
            const result = parse(e);
            if (result && result.comiket) {
                let cc = result.comiket;
                return cc.toUpperCase();
            } else {
                return "etc";
            }
        });

        const data = {};
        const filterFunction = (key, value) => {
            if(key === "etc"){
                return false;
            }
            if(value < 50){
                return false;
            }
            return true;
        }
        let { values, keys } = getKeyAndValues(byComiket, filterFunction)
        data.labels = keys;

        data.datasets = [{
            type: 'bar',
            label: 'by comiket',
            backgroundColor: "#15c69a",
            data: values
        }]

        const opt = {
            maintainAspectRatio: false,
            legend: {
                position: "right"
            }
        };

        let tableData = getKeyAndValues(byComiket)
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
                <Accordion header="Toggle Table" body={renderTable(tableData.keys, tableData.values)} />
            </div>
        );
    }

    rendeTimeChart(filtererFiles) {
        const { timeType, valueType, timeSourceType } = this.state;
        const byTime = {};

        filtererFiles.forEach(e => {
            const fileInfo = this.fileToInfo[e];
            //todo use choose use string time or only mtime
            let aboutTimeA;
            if (timeSourceType === BY_TAG_TIME) {
                aboutTimeA = nameParser.getDateFromParse(getBaseName(e));
                aboutTimeA = aboutTimeA && aboutTimeA.getTime();
                aboutTimeA = aboutTimeA || fileInfo.mtime;
            } else {
                aboutTimeA = fileInfo.mtime;
            }

            const t = new Date(aboutTimeA);
            const month = t.getMonth();
            const quarter = Math.floor(month / 3) + 1;

            let tLabel;
            if (timeType === BY_DAY) {
                tLabel = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
            } else if (timeType === BY_QUARTER) {
                tLabel = `${t.getFullYear()}-Q${quarter}`;
            } else if (timeType === BY_MONTH) {
                tLabel = `${t.getFullYear()}-${t.getMonth() + 1}`;
            } else {
                tLabel = t.getFullYear();
            }

            if (valueType === VALUE_COUNT) {
                byTime[tLabel] = byTime[tLabel] || 0;
                byTime[tLabel]++;
            } else if (valueType === VALUE_FILESIZE) {
                byTime[tLabel] = byTime[tLabel] || 0;
                byTime[tLabel] += (fileInfo.size || 0) / 1024 / 1024; //byte to MB
            }
        });

        const data = {};
        const { values, keys } = getKeyAndValues(byTime)
        data.labels = keys;
        data.datasets = [{
            type: 'line',
            label: this.state.timeType,
            backgroundColor: "orange",
            fill: false,
            showLine: true,
            tension: 0,
            data: values
        }];

        const TIME_OPITIONS = [BY_YEAR, BY_QUARTER, BY_MONTH, BY_DAY];
        const VALUE_OPTIONS = [VALUE_COUNT, VALUE_FILESIZE];
        const TIME_SOURCE_OPTIONS = [BY_MTIME, BY_TAG_TIME]

        return (
            <div className="individual-chart-container">
                <RadioButtonGroup
                    className="chart-radio-button-group"
                    checked={TIME_OPITIONS.indexOf(timeType)}
                    options={TIME_OPITIONS}
                    onChange={this.onTimeTypeChange.bind(this)} />
                <RadioButtonGroup
                    className="chart-radio-button-group"
                    checked={VALUE_OPTIONS.indexOf(valueType)}
                    options={VALUE_OPTIONS}
                    onChange={this.onValueTypeChange.bind(this)} />
                <RadioButtonGroup
                    className="chart-radio-button-group"
                    checked={TIME_SOURCE_OPTIONS.indexOf(timeSourceType)}
                    options={TIME_SOURCE_OPTIONS}
                    onChange={this.onTimeSourceTypeChange.bind(this)} />

                <div>
                    <Line
                        className="type-time-chart"
                        data={data}
                        width={800}
                        height={300}
                        options={{
                            maintainAspectRatio: false,
                            legend: {
                                position: "right"
                            }
                        }} />
                </div>
            </div>
        );
    }

    renderPieChart(filtererFiles) {
        if (this.isShowingVideoChart()) {
            return;
        }

        const byType = _.countBy(filtererFiles, e => {
            const result = parse(e);
            if (result && result.type) {
                return result.type;
            }
            return "etc"
        });

        const data = {};
        const { values, keys } = getKeyAndValues(byType)
        data.labels = keys;
        data.datasets = [{
            type: 'pie',
            label: 'by type',
            backgroundColor: ["#586185", "#23395B", "#406E8E", "#8EA8C3", "#CBF7ED", "#726a95", "#709fb0", "#a0c1b8", "#f4ebc1"],
            data: values
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

    renderTotalSize(filtererFiles) {
        let total = 0;
        const files = filtererFiles;
        const num = files.length;
        files.forEach(e => {
            total += this.fileToInfo[e].size;
        })
        return (<div className="total-info">
            <div>{`There are ${num} ${this.state.fileType} files`}</div>
            <div>{`Total: ${clientUtil.filesizeUitl(total)}`}</div>
        </div>)
    }

    // renderGoodBadDistribution() {
    //     if (this.isShowingVideoChart()) {
    //         return;
    //     }

    //     const { goodAuthors, otherAuthors } = this.state;
    //     const data = {
    //         labels: []
    //     };
    //     const segment = 0.05;

    //     for (let ii = 0; ii < 1 / segment; ii++) {
    //         data.labels.push((ii * segment));
    //     }

    //     if (goodAuthors && otherAuthors) {
    //         let allAuthors = _.keys(goodAuthors).concat(_.keys(otherAuthors));
    //         allAuthors = _.uniq(allAuthors);
    //         let value = [];

    //         allAuthors.forEach(aa => {
    //             const good = goodAuthors[aa] || 0;
    //             const other = otherAuthors[aa] || 0;
    //             let pp = good / (good + other);
    //             pp = pp.toFixed(2);

    //             for (let ii = 0; ii < data.labels.length; ii++) {
    //                 const segmentBeg = data.labels[ii];
    //                 const segmentEnd = segmentBeg + segment;

    //                 if (segmentBeg <= pp && pp < segmentEnd) {
    //                     value[ii] = value[ii] || 0;
    //                     value[ii]++;
    //                     break;
    //                 }
    //             }
    //         });

    //         data.labels = data.labels.slice(1);
    //         value = value.slice(1);
    //         // console.log(value);

    //         const opt = {
    //             maintainAspectRatio: false,
    //             legend: {
    //                 position: "right"
    //             }
    //         };

    //         data.datasets = [{
    //             type: 'line',
    //             label: 'good/(good+other) distribution',
    //             backgroundColor: "#15c69a",
    //             data: value,
    //             fill: false,
    //         }]

    //         return (
    //             <div className="individual-chart-container">
    //                 <Line
    //                     data={data}
    //                     width={800}
    //                     height={200}
    //                     options={opt}
    //                 />
    //             </div>
    //         );
    //     }
    // }

    onFileTypeChange(e) {
        this.setState({
            fileType: e
        });
    }

    onTimeTypeChange(e) {
        this.setState({
            timeType: e
        });
    }

    onValueTypeChange(e) {
        this.setState({
            valueType: e
        });
    }

    onTimeSourceTypeChange(e) {
        this.setState({
            timeSourceType: e
        });
    }


    render() {
        document.title = "Chart"
        const too_few = 5; // 30;

        const FILE_OPTIONS = [
            "video",
            "compressed"
        ];

        const filtererFiles = this.getFilterFiles();
        const { fileType } = this.state;
        const mode = this.getMode();

        let str = this.getTextFromQuery();
        if (this.isRecursive()) {
            str = `${str} And Subfolder's Files`
        } else if (mode === MODE_AUTHOR) {
            str = `Author: ${str}`
        } else if (mode === MODE_TAG) {
            str = `Tag: ${str}`
        } else if (mode === MODE_SEARCH) {
            str = `Search: ${str}`
        }

        const filePath = <div>{str}</div>;

        const radioGroup = <RadioButtonGroup
            className="chart-radio-button-group"
            checked={FILE_OPTIONS.indexOf(this.state.fileType)}
            options={FILE_OPTIONS}
            onChange={this.onFileTypeChange.bind(this)} />

        if (!this.res) {
            return (<CenterSpinner />);
        } else if (this.isFailedLoading()) {
            return <ErrorPage res={this.res} />;
        } else if (filtererFiles.length < too_few) {
            return (<div className="chart-container container">
                {filePath}
                {radioGroup}
                <div className="alert alert-info" role="alert" >
                    <div>{`There are only ${filtererFiles.length} ${fileType} files.`} </div>
                    <div>Unable to render chart</div>
                </div>
            </div>);
        } else {
            return (
                <div className="chart-container container">
                    {filePath}
                    {radioGroup}
                    {this.renderTotalSize(filtererFiles)}
                    {this.rendeTimeChart(filtererFiles)}
                    {this.renderComiketChart(filtererFiles)}
                    {this.renderPieChart(filtererFiles)}
                    {/* {this.renderGoodBadDistribution(filtererFiles)} */}
                </div>)
        }
    }
}

ChartPage.propTypes = {
    res: PropTypes.object
};
