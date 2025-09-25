import React, { Component } from 'react';
import '../../styles/FileNameDiv.scss';
var classNames = require('classnames');
const clientUtil = require("../../utils/clientUtil");
const nameParser = require('@name-parser');
import _ from 'underscore';
import ClickAndCopyDiv from './ClickAndCopyDiv';


function getText(filename, mecab_tokens) {
  const text = clientUtil.getBaseNameWithoutExtention(filename);
  const extension = filename.replace(text, "");

  const pResult = nameParser.parse(text);
  let allTags = [];
  let originalTags = [];
  let pTags = [];
  let authors;

  if (pResult) {
    originalTags = [...pResult.rawTags, ...pResult.charNames];
    authors = pResult.authors;

    if (pResult.comiket) {
      allTags.push(pResult.comiket);
    }

    if (pResult.group) {
      const includeAuthor =  authors && authors.length === 1 &&  pResult.group.includes(authors[0]);
      if(!includeAuthor){
        allTags.push(pResult.group);
      }
    }

    if (authors) {
      allTags.push(...authors);
    }

    allTags.push(...originalTags);
    pTags = allTags.slice();
  }
  // let nameTags = namePicker.pick(text) || [];
  let nameTags = [];
  allTags.push(...nameTags);


  //less meaningful
  // let lessTags = (mecab_tokens && mecab_tokens.length > 1) ? mecab_tokens : namePicker.splitBySpace(text);
  // lessTags = lessTags.filter(e => {
  //   const isUniq =  allTags.every(e2 => {
  //     return !e2.includes(e);
  //   });

  //   return isUniq;
  // });
  // allTags.push(...lessTags);

  //unique
  allTags = _.uniq(allTags);

  //sort by its index
  const tagIndexes = {};
  allTags.forEach(tag => {
    const index = text.indexOf(tag);
    if(index < 0){
      //todo
      //because tag converting, get index is not not so easy
    }
    tagIndexes[tag] = index;
  });
  allTags = _.sortBy(allTags, tag => {
    return tagIndexes[tag];
  });

  function getPriority(str) {
    if (pTags.includes(str)) {
      return 4;
    } else if (nameTags.includes(str)) {
      return 3;
    } else {
      return 1;
    }
  }

  //tag1 may include tag2. remove the short one
  const willRemove = {};
  for (let ii = 0; ii < allTags.length; ii++) {
    const t1 = allTags[ii];
    if (willRemove[t1]) {
      continue;
    }
    for (let jj = ii + 1; jj < allTags.length; jj++) {
      const t2 = allTags[jj];
      if (t1.includes(t2)) {
        const p1 = getPriority(t1);
        const p2 = getPriority(t2);
        if (p1 < p2) {
          willRemove[t1] = true;
        } else {
          willRemove[t2] = true;
        }
      }
    }
  }
  allTags = allTags.filter(e => !willRemove[e]);

  let tempText = text;
  // const SEP = "||__SEP__||"
  // sep不能含有常见字符，有作者名字就叫一个p。直接就炸掉了
  const SEP = "ⶤ▒"
  allTags.forEach(tag => {
    //https://stackoverflow.com/questions/4514144/js-string-split-without-removing-the-delimiters
    const tempHolder = SEP + tag + SEP;
    tempText = tempText.replaceAll(tag, tempHolder)
  })
  const formatArr = [];
  tempText.split(SEP).map((token, ii) => {
    if (allTags.includes(token)) {
      const tag = token;
      let url;
      if (authors && authors.includes(tag)) {
        url = clientUtil.getAuthorLink(tag);
      } else if (originalTags && originalTags.includes(tag)) {
        url = clientUtil.getTagLink(tag);
      } else {
        url = clientUtil.getSearhLink(tag);
      }

      const cn = classNames("embed-link", {
        "with-color": getPriority(tag) > 1
      });

      const link = <a className={cn} target="_blank" href={url} key={tag+ii}>{tag}</a>;
      formatArr.push(link);
    } else {
      formatArr.push(token);
    }
  });

  if (extension) {
    formatArr.push(extension);
  }

  return <span> {formatArr} </span>
}



export default function FileNameDiv(props) {
    const { filename, className, mecab_tokens, isVideo, ...others } = props;
    return (
      <span className="aji-file-name">
        {getText(filename, mecab_tokens)}
        <ClickAndCopyDiv text={filename} />
      </span>)
}


