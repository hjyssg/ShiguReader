import React, { Component } from 'react';
import './style/app.css';
import Home from './Home';
import OneBook from './OneBook';
import PropTypes from 'prop-types';
import _ from "underscore";
import Button from 'react-bootstrap/lib/Button';
import Nav from 'react-bootstrap/lib/Nav';

const MODES = ["home", "author" ,"tag", "genre", "onebook"];

const imageTypes = ["jpg", "png"];
const compressTypes = ["zip", "rar"];
_.isImage = function(fn){
	return imageTypes.some((e)=> fn.endsWith(e));
}
_.isCompress = function(fn){
	return compressTypes.some((e)=> fn.endsWith(e));
}

_.resHandle = function(res){
  if(res.status === 200){
    return res.json();
  } else {
    console.error("[failed]", res);
    return {failed: true, res: res.status};
  }
}

//http://localhost:3000/
export default class App extends Component {
  state = {  mode:"home" };

  swithToOneBook(zipPath){
    this.setState({
      mode: "onebook",
      zipPathForOneBook: zipPath
    });
  }

  chooseSubComponent(){
    if(this.state.mode === "home"){
      return <Home modeChange={this.swithToOneBook.bind(this)}/>;
    }else if (this.state.mode === "onebook"){
      return <OneBook filePath={this.state.zipPathForOneBook}/>
    }
  }

  render() {
    const { mode } = this.state;
    const listItems = MODES.map(function(item, index){
      return (<Nav.Item key={index}><Nav.Link src={item}>{item.toUpperCase()} </Nav.Link></Nav.Item>);
    });
    return (
      <div className="app-container">
        <Nav fill variant="tabs" activeKey="/home" onSelect={selectedKey => {this.setState({mode: selectedKey})}}>
          {listItems}
        </Nav>
        {this.chooseSubComponent()}
      </div>
    );
  }
}

App.propTypes = {

};