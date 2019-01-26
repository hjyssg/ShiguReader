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

export default class OneBook extends Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      index: -1
    };
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
  
  showAuthorFiles(author) {
    Sender.post("/api/search", { author }, res => {
      this.props.openDirFunc("", [], res.authorFiles);
    });
  }
  
  showTagFiles(tag) {
    Sender.post("/api/search", { tag }, res => {
      this.props.openDirFunc("", [], res.tagFiles);
    });
  }
  
  getHash(){
    return this.props.match.params.number;
  }
  
  componentDidMount() {
    const file = this.getHash();
    if(file && this.loadedHash !== file){
      this.displayFile(file);
    }
  }
  
  componentDidUpdate() {
    this.componentDidMount();
  }
  
  displayFile(file){
    Sender.post("/api/extract", {  hash: this.getHash() }, res => {
      if (!res.failed) {
        this.loadedHash = this.getHash();
        this.setState({ files: res.files || [], index: 0, path:res.path });
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
      }else{
        this.res = res;
        this.forceUpdate();
      }
    });
  }
  
  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
  }
  
  handleKeyDown(event) {
    if (event.key === "ArrowRight") {
      this.changePage(this.state.index + 1);
    } else if (event.key === "ArrowLeft") {
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

  render() {
    if (this.isFailedLoading()) { 
      return <ErrorPage res={this.res.res}/>;
    }
    
    const { files, index } = this.state;
    if (_.isEmpty(files)) {
      return (
        <div className="one-book-loading">
          {<Spinner />}
          { "Loading..."}
        </div>
      );
    }
    
    const result = nameParser.parse(_.getFn(this.state.path));
    const author = result && result.author;
    let tags = (result && result.tags)||[];
    //temp
    tags = author? tags.concat(author): tags;
    
    if (screen.width > 1500) {
      const tagDivs = tags.length > 0 && tags.map((tag)=>{
        const tagHash = stringHash(tag);
        const url = "/tag/" + tagHash;
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
          <div className="one-book-footer">
            <div className="one-book-foot-index-number">{`${index+1}/${files.length}` }</div>
            {tagDivs}
          </div>
         {this.state.path && 
            <div className="one-book-path">
              <span className="one-book-delete-cmd fas fa-trash-alt"
                    title="Copy Del command"
                    onClick={this.copyToClipboard.bind(this)}></span>
              <Link to={toUrl}>{parentPath} </Link>
            </div>}
        </div>
      );
    } else {
      return (
        <div>
        {this.renderFileList()}
        <h4 className="one-book-title">{this.props.filePath}</h4>
        </div>
      );
    }
  }
}

OneBook.propTypes = {
};
