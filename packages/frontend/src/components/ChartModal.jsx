import React, { Component } from "react";
import Modal from "react-modal";
import "@styles/ChartPage.scss";
import _ from "underscore";
import RadioButtonGroup from "@components/common/RadioButtonGroup";
import Accordion from "@components/common/Accordion";
import PropTypes from "prop-types";

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import {
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

import {
  do_statitic_by_time_v2,
  getKeyAndValues,
  calculateTotalFilesAndSize,
  SimpleDataTable,
} from "@utils/ChartUtil";

const clientUtil = require("@utils/clientUtil");

ChartJS.register(ArcElement, Tooltip, Legend);
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  BarElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
);

const BY_YEAR = "by year";
const BY_QUARTER = "by quarter";
const BY_MONTH = "by month";
const BY_DAY = "by day";

const VALUE_COUNT = "file number";
const VALUE_FILESIZE = "file size in GB";

const BY_MTIME = "by mtime";
const BY_TAG_TIME = "by tag time";

const FILE_OPTIONS = ["video", "compress"];
const TIME_OPTIONS = [BY_YEAR, BY_QUARTER, BY_MONTH, BY_DAY];
const VALUE_OPTIONS = [VALUE_COUNT, VALUE_FILESIZE];
const TIME_SOURCE_OPTIONS = [BY_MTIME, BY_TAG_TIME];

export default class ChartModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fileType: "compress",
      timeType: BY_YEAR,
      timeSourceType: BY_MTIME,
      valueType: VALUE_COUNT,
    };
  }

  componentDidUpdate(prevProps) {
    const { data } = this.props;
    if (data !== prevProps.data) {
      const hasVideoData = this.hasVideoData(data);
      if (!hasVideoData && this.state.fileType === "video") {
        this.setState({ fileType: "compress" });
      }
    }
  }

  getData() {
    return this.props.data || {};
  }

  hasVideoData(data) {
    if (!data || !data.ByTagTime) {
      return false;
    }
    return _.some(data.ByTagTime, (value) => value && value.video);
  }

  onFileTypeChange(e) {
    this.setState({
      fileType: e,
    });
  }

  onTimeTypeChange(e) {
    this.setState({
      timeType: e,
    });
  }

  onValueTypeChange(e) {
    this.setState({
      valueType: e,
    });
  }

  onTimeSourceTypeChange(e) {
    this.setState({
      timeSourceType: e,
    });
  }

  renderComiketChart(data) {
    if (!data || !data.byComiket) {
      return null;
    }

    if (this.state.fileType === "video") {
      return null;
    }

    const filterFunction = (key, value) => {
      if (key === "etc") {
        return false;
      }
      if (value < 50) {
        return false;
      }
      return true;
    };

    const { values, keys } = getKeyAndValues(data.byComiket, filterFunction);

    if (!keys.length) {
      return null;
    }

    const chartData = {
      labels: keys,
      datasets: [
        {
          type: "bar",
          label: "file number",
          backgroundColor: "#15c69a",
          data: values,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
    };

    const tableData = getKeyAndValues(data.byComiket);

    return (
      <div className="individual-chart-container">
        <div>
          <Bar data={chartData} width={800} height={200} options={options} />
        </div>
        <Accordion
          header="Toggle Table"
          body={<SimpleDataTable labels={tableData.keys} values={tableData.values} />}
        />
      </div>
    );
  }

  rendeTimeChart(data) {
    if (!data || !data.ByTagTime || !data.byMTime) {
      return null;
    }

    const { timeType, valueType, timeSourceType } = this.state;
    const byTime = do_statitic_by_time_v2(
      data.ByTagTime,
      data.byMTime,
      this.state.fileType,
      timeSourceType,
      valueType,
      timeType,
    );

    const { values, keys } = getKeyAndValues(byTime);

    if (!keys.length) {
      return null;
    }

    const chartData = {
      labels: keys,
      datasets: [
        {
          type: "line",
          label: valueType,
          backgroundColor: "orange",
          fill: false,
          showLine: true,
          tension: 0,
          data: values,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
    };

    return (
      <div className="individual-chart-container">
        <RadioButtonGroup
          className="chart-radio-button-group"
          checked={TIME_OPTIONS.indexOf(timeType)}
          options={TIME_OPTIONS}
          onChange={this.onTimeTypeChange.bind(this)}
        />
        <RadioButtonGroup
          className="chart-radio-button-group"
          checked={VALUE_OPTIONS.indexOf(valueType)}
          options={VALUE_OPTIONS}
          onChange={this.onValueTypeChange.bind(this)}
        />
        <RadioButtonGroup
          className="chart-radio-button-group"
          checked={TIME_SOURCE_OPTIONS.indexOf(timeSourceType)}
          options={TIME_SOURCE_OPTIONS}
          onChange={this.onTimeSourceTypeChange.bind(this)}
        />

        <div>
          <Line
            className="type-time-chart"
            data={chartData}
            width={800}
            height={300}
            options={options}
          />
        </div>
      </div>
    );
  }

  renderPieChart(data) {
    if (!data || !data.byType || this.state.fileType === "video") {
      return null;
    }

    const { values, keys } = getKeyAndValues(data.byType);

    if (!keys.length) {
      return null;
    }

    const colors = [
      "rgba(255, 99, 132, 0.2)",
      "rgba(54, 162, 235, 0.2)",
      "rgba(255, 206, 86, 0.2)",
      "rgba(75, 192, 192, 0.2)",
      "rgba(153, 102, 255, 0.2)",
      "rgba(255, 159, 64, 0.2)",
    ];

    const chartData = {
      labels: keys,
      datasets: [
        {
          type: "pie",
          label: "by type",
          backgroundColor: colors,
          borderColor: [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(255, 159, 64, 1)",
          ],
          data: values,
        },
      ],
    };

    const options = {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
        },
      },
    };

    return (
      <div className="individual-chart-container">
        <Pie
          className="type-pie-chart"
          data={chartData}
          width={300}
          height={300}
          options={options}
        />
      </div>
    );
  }

  renderTotalSize(data) {
    if (!data || !data.ByTagTime) {
      return null;
    }

    const { totalFileCount, totalFileSize } = calculateTotalFilesAndSize(
      data.ByTagTime,
      this.state.fileType,
    );

    if (!totalFileCount) {
      return null;
    }

    return (
      <div className="total-info">
        <div>{`There are ${totalFileCount} ${this.state.fileType} files`}</div>
        <div>{`Total: ${clientUtil.filesizeUitl(totalFileSize)}`}</div>
      </div>
    );
  }

  renderContent() {
    const data = this.getData();

    if (!data || _.isEmpty(data)) {
      return (
        <div className="chart-container container">
          <div className="chart-empty">No chart data available.</div>
        </div>
      );
    }

    return (
      <div className="chart-container container">
        {this.props.contextText && (
          <div className="chart-context">{this.props.contextText}</div>
        )}
        <RadioButtonGroup
          className="chart-radio-button-group"
          checked={FILE_OPTIONS.indexOf(this.state.fileType)}
          options={FILE_OPTIONS}
          onChange={this.onFileTypeChange.bind(this)}
        />
        {this.renderTotalSize(data)}
        {this.rendeTimeChart(data)}
        {this.renderComiketChart(data)}
        {this.renderPieChart(data)}
      </div>
    );
  }

  render() {
    const { isOpen, onRequestClose } = this.props;

    return (
      <Modal
        isOpen={isOpen}
        onRequestClose={onRequestClose}
        ariaHideApp={false}
        className="chart-modal"
        overlayClassName="chart-modal__overlay"
        contentLabel="Chart overview"
      >
        <div className="chart-modal__header">
          <div className="chart-modal__title">
            <i className="fas fa-chart-bar" aria-hidden="true" />
            <span>Chart</span>
          </div>
          <button
            type="button"
            className="chart-modal__close"
            onClick={onRequestClose}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        <div className="chart-modal__body">{this.renderContent()}</div>
      </Modal>
    );
  }
}

ChartModal.propTypes = {
  isOpen: PropTypes.bool,
  onRequestClose: PropTypes.func,
  data: PropTypes.object,
  contextText: PropTypes.string,
};

ChartModal.defaultProps = {
  isOpen: false,
  onRequestClose: _.noop,
  data: null,
  contextText: "",
};

