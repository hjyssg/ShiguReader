
const clientUtil = require("./clientUtil");
const { getBaseName } = clientUtil;
import _ from "underscore";
import React, { Component } from "react";


const BY_MTIME = "by mtime";
const BY_TAG_TIME = "by tag time";

const BY_YEAR = "by year";
const BY_QUARTER = "by quarter";
const BY_MONTH = "by month";
const BY_DAY = "by day";

const VALUE_COUNT = "file number";
const VALUE_FILESIZE = "file size in GB";


export const do_statitic_by_time_v2 = (ByTagTime, byMTime, type, timeSourceType, valueType, timeType) => {
    // 选择合适的数据源
    const dataSource = timeSourceType === BY_TAG_TIME ? ByTagTime : byMTime;

    // 初始化结果对象
    const result = {};

    // 遍历数据源
    for (const timestamp in dataSource) {
        if (dataSource.hasOwnProperty(timestamp)) {
            const date = new Date(parseInt(timestamp));
            const data = dataSource[timestamp][type];

            if (!data) continue; // 如果没有对应类型的数据，跳过

            // 根据 valueType 选择统计的值
            const value = valueType === VALUE_COUNT ? data.fileCount : data.fileSize / (1024 * 1024); // 转换为MB

            // 根据 timeType 生成键
            let key;
            switch (timeType) {
                case BY_YEAR:
                    key = date.getFullYear();
                    break;
                case BY_QUARTER:
                    key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
                    break;
                case BY_MONTH:
                    key = `${date.getFullYear()}-${date.getMonth() + 1}`;
                    break;
                case BY_DAY:
                    key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                    break;
                default:
                    throw new Error("Unsupported timeType");
            }

            // 合并数据
            if (!result[key]) {
                result[key] = 0;
            }
            result[key] += value;
        }
    }

    return result;
};

/**
 * 从对象中获取并排序键，基于提供的函数进行过滤，
 * 并返回一个包含过滤后键及其对应值的对象。
 *
 * @param {Object} keyToValueTable - 包含键值对的对象。
 * @param {Function} [filterFunction] - 用于过滤键值对的函数。接收一个键及其值并返回一个布尔值。
 * @returns {{keys: Array<string>, values: Array<any>}} 一个包含排序和过滤后的键及其对应值的对象。
 */
export function getKeyAndValues(keyToValueTable, filterFunction) {
    const tempKeys = _.keys(keyToValueTable);
    tempKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const values = [];
    let keys = [];
    tempKeys.forEach((key) => {
      const value = keyToValueTable[key];
  
      if (filterFunction && !filterFunction(key, value)) {
        return;
      }
      values.push(value);
      keys.push(key);
    });
  
    return {
      keys,
      values,
    };
  }


export const SimpleDataTable = ({labels, values}) => {
    const tableHeader = (
      <thead>
        <tr>
          <th scope="col">name</th>
          <th scope="col">number</th>
        </tr>
      </thead>
    );
  
    const rows = labels.map((e, index) => {
      return (
        <tr key={index}>
          <th scope="row">{e}</th>
          <td>{values[index]}</td>
        </tr>
      );
    });
  
    return (
      <table className="table aji-table">
        {tableHeader}
        <tbody>{rows}</tbody>
      </table>
    );
  }