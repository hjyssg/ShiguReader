import React, { Component, useState, useEffect } from 'react';
import _ from 'underscore';
const clientUtil = require("../../utils/clientUtil");
// const classNames = require('classnames');
// import ReactDOM from 'react-dom';

import Sender from '../../services/Sender';


function HistorySection(props){
  const {filePath} = props;
  const [history, setHistory] = useState([]);
  const [collapse, setCollapse] = useState(true);


  useEffect(() => {
    async function fetchData() {
        const res = await Sender.postWithPromise("/api/getHistoryForOneFile", {filePath});
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
      items = history.map((e, ii) => {
          const key = e.time + "_" + ii;
          return <div key={key} className='history-item'>{clientUtil.dateFormat_v1(e.time) }</div>
      });

      if(items.length > 10 && collapse){
        const middle = (<div className='history-ellipsis fa fa-ellipsis-h' key="ellipsis" onClick={()=>setCollapse(false)}>  </div>);
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