import React, { Component } from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';
const nameParser = require('../name-parser');
import { Link } from 'react-router-dom';
import stringHash from "string-hash";
import Sender from './Sender';
import './style/oneBook.css';
import ErrorPage from './ErrorPage';


export default class OneBook extends Component {
  
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      index: -1
    };
  }
  
  showAuthorFiles(author) {
    Sender.post("/api/tagSearch", { author }, res => {
      this.props.openDirFunc("", [], res.authorFiles);
    });
  }
  
  showTagFiles(tag) {
    Sender.post("/api/tagSearch", { tag }, res => {
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
  
  render() {
    if (this.res && this.res.failed) {
      return <ErrorPage res={this.res.res}/>;
    }
    
    const { files, index } = this.state;
    if (_.isEmpty(files)) {
      return (
        <div className="one-book-loading">
        { "is Loading..."}
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
      
      return (  
        <div>
        <div className="one-book-container">
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
