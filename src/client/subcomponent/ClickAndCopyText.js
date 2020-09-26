import React, { Component } from 'react';
import '../style/ClickAndCopyText.scss';
import PropTypes from 'prop-types';
var classNames = require('classnames');
const clientUtil = require("../clientUtil");
import { toast } from 'react-toastify';
const namePicker = require("../../human-name-picker");
const nameParser = require('@name-parser');
import _ from 'underscore';





function iosCopyToClipboard(el) {
  //https://stackoverflow.com/questions/34045777/copy-to-clipboard-using-javascript-in-ios/34046084
  var oldContentEditable = el.contentEditable,
      oldReadOnly = el.readOnly,
      range = document.createRange();

  el.contentEditable = true;
  el.readOnly = false;
  range.selectNodeContents(el);

  var s = window.getSelection();
  s.removeAllRanges();
  s.addRange(range);

  el.setSelectionRange(0, 999999); // A big number, to cover anything that could be inside the element.

  el.contentEditable = oldContentEditable;
  el.readOnly = oldReadOnly;

  document.execCommand('copy');
}

export default class ClickAndCopyText extends Component {
  onTitleClick(){
    //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
    var textArea = document.createElement("textarea");
    textArea.value = this.props.text;
    document.body.appendChild(textArea);

    if(clientUtil.isIOS()){
      iosCopyToClipboard(textArea)
    }else{
      textArea.select();
      document.execCommand("Copy");
    }
    textArea.remove();

    toast('Copied to Clipboard', {
      className: "one-line-toast",
      position: "top-right",
      autoClose: 3 * 1000,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true
    })
  }

  getText(){
    const text = clientUtil.getBaseNameWithoutExtention(this.props.text);
    // const dirName = getBaseName(getDir(this.getTextFromQuery()));
    const pResult = nameParser.parse(text);
    let allTags = [];
    let originalTags;
    let authors;

    if(pResult){
      originalTags = pResult.tags;
      authors = pResult.authors;

      if(pResult.comiket){
        allTags.push(pResult.comiket);
      }

      if(pResult.group){
        allTags.push(pResult.group);
      }
      
      if(authors){
        allTags = allTags.concat(authors);
      }
      allTags = allTags.concat(originalTags);
    }else{
      const nameTags = namePicker.pick(text)||[];
      allTags = allTags.concat(nameTags);
    }

    //less meaningful
    let lessTags = namePicker.splitBySpace(text);
    lessTags = lessTags.filter(e => !allTags.includes(e));
    allTags = allTags.concat(lessTags);

    allTags = _.uniq(allTags);
    //sort by its index
    const tagIndexes = {};
    allTags.forEach(tag => {
      const index = text.indexOf(tag);
      tagIndexes[tag] = index;
    });
    allTags = _.sortBy(allTags, tag => {
      return tagIndexes[tag];
    });

    //tag1 may include tag2. remove the short one
    const willRemove = {};
    for(let ii = 0; ii < allTags.length; ii++){
      const t1 = allTags[ii];
      if(willRemove[t1]){
        continue;
      }
      for(let jj = ii+1; jj < allTags.length; jj++){
        const t2 = allTags[jj];
        if(t1.includes(t2)){
          if(lessTags.includes(t1)){
            willRemove[t1] = true;
          }else{
            willRemove[t2] = true;
          }

          willRemove[t2] = true;
        }
      }
    }
    allTags = allTags.filter(e => !willRemove[e]);

    let tempText = text;
    const SEP = "||__SEP__||"
    allTags.forEach(tag => {
      //https://stackoverflow.com/questions/4514144/js-string-split-without-removing-the-delimiters
      const tempHolder = SEP+tag+SEP;
      tempText = tempText.replace(tag, tempHolder)
    })
    const formatArr = [];
    tempText.split(SEP).map(token => {
      if( allTags.includes(token)){
        const tag = token;
        let url;
        if(authors && authors.includes(tag)){
          url = clientUtil.getAuthorLink(tag);
        }else if(originalTags && originalTags.includes(tag)){
          url = clientUtil.getTagLink(tag);
        }else{
          url = clientUtil.getSearhLink(tag);
        }

        const lsLessImportant = lessTags.includes(tag);

        const cn = classNames("embed-link", {
          "with-color": !lsLessImportant
        });

        const link = <a className={cn}  target="_blank" href={url}  key={tag}>{tag}</a>;
        formatArr.push(link);
      }else{
        formatArr.push(token);
      }
    })

    const tagInfo = {};
    return <span> {formatArr} </span>
  }
  
  render(){
    const { text, className, isVideo, ...others } = this.props;
    const cn2 = classNames("click-and-copy-text", className, "fas fa-copy")
    return(
    <span className="aji-file-name">
      {this.getText()}
      <span onClick={this.onTitleClick.bind(this)} className={cn2}/>
    </span>)
  }
}

ClickAndCopyText.propTypes = { 
  text: PropTypes.string
};
