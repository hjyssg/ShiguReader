import React, { Component } from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';
const nameParser = require('../name-parser');
import { Link } from 'react-router-dom';
import stringHash from "string-hash";
import Sender from './Sender';
import './style/OneBook.scss';
import ErrorPage from './ErrorPage';
import Spinner from './subcomponent/Spinner';
const spop  = require("./subcomponent/spop");
import FileChangeToolbar from './subcomponent/FileChangeToolbar';
var classNames = require('classnames');
var dateFormat = require('dateformat');

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      index: -1
    };

    this.failTimes = 0;
  }

  copyToClipboard(event){
    //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
    var textArea = document.createElement("textarea");
    textArea.value = "DEL \"" +  this.state.path + "\"";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    textArea.remove();

    spop({
      template: 'Copied to Clipboard',
      position: 'bottom-right',
      autoclose: 3000
    });
  }
  
  getHash(){
    return this.props.match.params.number;
  }
  
  componentDidMount() {
    const file = this.getHash();
    if(file && this.loadedHash !== file && this.failTimes < 3){
      this.displayFile(file);
    }
  }
  
  componentDidUpdate() {
    this.componentDidMount();
  }
  
  displayFile(file){
    Sender.post("/api/extract", {  hash: this.getHash() }, res => {
      this.res = res;

      if (!res.failed) {
        this.loadedHash = this.getHash();
        this.setState({ files: res.files || [], index: 0, path:res.path, fileStat: res.stat });
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
      }else{
        this.failTimes++;
        this.forceUpdate();
      }
    });
  }
  
  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }
  
  handleKeyDown(event) {
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      this.changePage(this.state.index + 1);
    } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      this.changePage(this.state.index - 1);
    }
  }
  
  changePage(index) {
    const lastIndex = (this.state.files || []).length - 1;
    if (index < 0) {
      return;
    } else if (index > lastIndex) {
      spop({
        template: 'Last Page',
        position: 'top-right',
        autoclose: 3000
      });
      return;
    }
    this.setState({ index });
  }
  
  next(event) {
    let index = parseInt(event.target.getAttribute("index")) + 1;
    event.preventDefault();
    this.changePage(index);
  }
  
  prev(event) {
    let index = parseInt(event.target.getAttribute("index")) - 1;
    event.preventDefault();
    this.changePage(index);
  }
  
  renderFileList() {
    const { files, index } = this.state;
    const listItems = files.map((item) => (<li className="one-book-image-li" key={item}><img className="one-book-image" src={"../"+item} alt="book-image"/></li>));
    return (<ul className="one-book-list">{listItems}</ul>);
  }
  
  isFailedLoading(){
    return this.res && this.res.failed;
  }

  renderPagination() {
    const { files, index } = this.state;
    const isLast = index+1 === files.length;
    const text = (index+1) + "/" + files.length;
    const cn = classNames("one-book-foot-index-number", {
      "is-last": isLast
    })
    
    return <div className={cn}>{text}</div>;
  }

  renderFileSizeAndTime(){
    if(this.state.fileStat){
      const size = Math.ceil(this.state.fileStat.size/ 1000000.0) + "MB";
      const mTime = dateFormat(this.state.fileStat.mtime, "isoDate");;
      const text = mTime + " :: " + size;
      return <div className={"file-stat"}>{text} </div>
    }
  }

  render() {
    if (this.isFailedLoading()) { 
      return <ErrorPage res={this.res.res}/>;
    }
    
    const { files, index } = this.state;
    if (_.isEmpty(files)) {
      if(this.res && !this.refs.failed){
        return <h3><center>no content files</center></h3>;
      } else {
        return (
          <div className="one-book-loading">
            {<Spinner />}
            { "Loading..."}
          </div>
        );
      } 
    }
    
    const result = nameParser.parse(_.getFn(this.state.path));
    const author = result && result.author;
    let tags = (result && result.tags)||[];
    //temp
    tags = author? tags.concat(author): tags;
    
    const tagDivs = tags.length > 0 && tags.map((tag)=>{
      const tagHash = stringHash(tag);
      const url = tag === author? ("/author/" + tagHash) : ("/tag/" + tagHash);
      return (<div key={tag} className="one-book-foot-author" >
                <Link to={url}  key={tag}>{tag}</Link>
              </div>);
    })
  
    const parentPath = _.getDir(this.state.path);
    const parentHash = stringHash(parentPath);
    const toUrl =('/explorer/'+ parentHash);

    if(this.state.path){
      document.title = _.getFn(this.state.path);
    }

    return (  
      <div className="one-book-container">
        <div className="one-book-wrapper">
          <div className="one-book-title"><center>{_.getFn(this.state.path)}</center></div>
          <img className="one-book-image" src={"../" + files[index]} alt="book-image"
          onClick={this.next.bind(this)}
          onContextMenu={this.prev.bind(this)}
          index={index}
          />
        </div>
        {this.renderPagination()}
        <div className="one-book-footer">
          {tagDivs}
        </div>
        {this.state.path && 
          <div className="one-book-path">
            <Link to={toUrl}>{parentPath} </Link>
            <FileChangeToolbar className="one-book-toolbar" file={this.state.path} />
          </div>
        }
        {this.renderFileSizeAndTime()}
        {/* {
          this.state.path && <FileChangeToolbar className="one-book-toolbar" file={this.state.path} />
        } */}
      </div>
    );
  }
}

OneBook.propTypes = {
};
