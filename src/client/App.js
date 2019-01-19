import React, { Component } from 'react';
import './style/app.css';
import Home from './Home';
import OneBook from './OneBook';
import TagPage from './TagPage';
import _ from "underscore";
const path = require('path');
import Nav from 'react-bootstrap/lib/Nav';

const MODES = ["home", "author" ,"tag",  "onebook"];

const imageTypes = ["jpg", "png"];
const compressTypes = ["zip", "rar"];
_.isImage = function(fn){
	return imageTypes.some((e)=> fn.endsWith(e));
}
_.isCompress = function(fn){
	return compressTypes.some((e)=> fn.endsWith(e));
}

_.getDir = function(fn){
  const tokens = fn.split("\\");
  return tokens.slice(0, tokens.length-1).join("\\");
}

_.getFn = function(fn){
  const tokens = fn.split("\\");
  return tokens[tokens.length-1];
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
    if (this.state.mode === "home"){
      return <Home ref={(homePage) => {this.homePage = homePage}} modeChange={this.swithToOneBook.bind(this)} pathForHome={this.state.pathForHome}/>;
    } else if (this.state.mode === "onebook"){
      return <OneBook filePath={this.state.zipPathForOneBook}/>
    } else if (this.state.mode === "tag"){
      return <TagPage mode="tag"/>;
    } else if (this.state.mode === "author"){
      return <TagPage mode="author"/>;
    }
  }

  switchMode(selectedKey){
    if(selectedKey === "back"){
      if(this.state.mode === "onebook"){
        const p = _.getDir(this.state.zipPathForOneBook);
        this.setState({mode:"home", pathForHome: p});
      } else if(this.state.mode === "home"){
        const p =  _.getDir(this.homePage.state.currentPath);
        this.setState({mode:"home", pathForHome: p});
      }
    }else{
      this.setState({mode: selectedKey});
    }
  }

  render() {
    const { mode } = this.state;
    const that = this;
    let navs = ["home", "author" ,"tag"];

    if(this.state.mode === "onebook" || this.state.mode === "home" ){
      navs = ["back"].concat(navs);
    }

    const listItems = navs.map(function(item, index){
      return (<Nav.Item key={index}>
                  <Nav.Link className={`app-nav-item app-nav-item-${item}`} src={item} onClick={that.switchMode.bind(that, item)}>{item.toUpperCase()} </Nav.Link>
              </Nav.Item>);
    });
    return (
      <div className="app-container">
        <Nav fill variant="tabs">
          {listItems}
        </Nav>
        {this.chooseSubComponent()}
      </div>
    );
  }
}

App.propTypes = {

};