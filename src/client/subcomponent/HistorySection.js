import React, { Component, useState, useEffect } from 'react';
import _ from 'underscore';
const classNames = require('classnames');
const dateFormat = require('dateformat');
import ReactDOM from 'react-dom';

import Sender from '../Sender';


function HistorySection(props){
  const {filePath} = props;
  const [history, setHistory] = useState([]);

  useEffect(() => {
    async function fetchData() {
        const res = await Sender.postWithPromise("/api/getHistoryByFP", {filePath});
        if (!res.isFailed()) {
            let { history } = res.json;
            setHistory(history)
        }
    }
    fetchData();
}, []); 

  let items;
  let length = history.length;
  if (length === 0) {
      return <div className="history-section">It is first time to read this book</div>;
  } else {
      items = history.map(e => {
          // return <div key={e.time}>{dateFormat(e.time, "dddd, mmmm dS, yyyy, h:MM:ss TT") }</div>
          return <div key={e.time}>{dateFormat(e.time, "yyyy-mm-dd HH:MM") }</div>
      });

      if(items.length > 10){
        const middle = (<div> ... </div>);
        items = items.slice(0, 3).concat(middle, items.slice(length - 4))
      }
  }

  return (
      <div className="history-section">
          <div className="history-section-title"> You have read this {length} times</div>
          <div className="history-section-content">
              {items}
          </div>
      </div>)
}

export default HistorySection;