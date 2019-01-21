import React, { Component } from 'react';
import './style/app.css';
import _ from "underscore";
import Nav from 'react-bootstrap/lib/Nav';
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import TagPage from "./TagPage";
import Sender from './Sender';

const userConfig = require('../user-config');

// const MODES = ['home', 'author', 'tag', 'onebook'];

const imageTypes = ['.jpg', '.png'];
const compressTypes = ['.zip', '.rar'];
_.isImage = function (fn) {
    return imageTypes.some(e => fn.endsWith(e));
};
_.isCompress = function (fn) {
    return compressTypes.some(e => fn.endsWith(e));
};

_.getDir = function (fn) {
   //get parent
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

_.getFn = function (fn) {
    const tokens = fn.split('\\');
    return tokens[tokens.length - 1];
};

_.resHandle = function (res) {
    if (res.status === 200) {
        return res.json();
    }
    console.error('[failed]', res.status, res.statusText);
    return { failed: true, res: res.status };
};

// http://localhost:3000/
export default class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      mode: 'home',

      PathForExplorer: "",
      dirsForExplorer: userConfig.home_pathes,
      filesForExplorer: [],

      zipPathForOneBook: ""
    };
  }

  openBookFunc(zipPath) {
      this.setState({
          mode: 'onebook',
          zipPathForOneBook: zipPath,
      });
  }

  openDirFunc(path, dirs, files) {
    this.setState({
        mode: "home",
        PathForExplorer: path,
        dirsForExplorer: dirs,
        filesForExplorer: files
    });
  }

  chooseSubComponent() {
      const { mode, PathForExplorer, dirsForExplorer, filesForExplorer, zipPathForOneBook } = this.state;
      if (mode === "home") {
          return (
              <ExplorerPage
                  ref={homePage => {
                      this.homePage = homePage;
                  }}
                  dirs={dirsForExplorer}
                  files={filesForExplorer}
                  openDirFunc={this.openDirFunc.bind(this)}
                  openBookFunc={this.openBookFunc.bind(this)}
                  PathForExplorer={PathForExplorer}
              />
          );
      } else if (mode === "onebook") {
          return (<OneBook filePath={zipPathForOneBook} openDirFunc={this.openDirFunc.bind(this)}/>);
      } else if (mode === "tag") {
          return <TagPage mode="tag" />;
      } else if (mode === "author") {
          return <TagPage mode="author"  openDirFunc={this.openDirFunc.bind(this)} />;
      } else {
          return (<div>{mode}</div>);
      }
  }

  changeExplorerPath(dir) {
    Sender.lsDir({ dir }, res => {
        if (!res.failed) {
          this.openDirFunc(dir, res.dirs, res.files);
        }
    });
  }

  handleBackButton(){
    const { mode, zipPathForOneBook, PathForExplorer } = this.state;
    let p;
    if (mode === 'onebook') {
        p = _.getDir(zipPathForOneBook);
        this.changeExplorerPath(p);

        //go back to author

    } else if (mode === 'home') {
        p = _.getDir(PathForExplorer);
        this.changeExplorerPath(p);
    }
  }

  switchMode(selectedKey) {
      if (selectedKey === 'back') {
        this.handleBackButton();
      } else if (selectedKey === "home") {
        this.setState({
          mode: 'home',
          PathForExplorer: "",
          dirsForExplorer: userConfig.home_pathes,
          filesForExplorer: [],
          zipPathForOneBook: ""
        });
      } else {
          this.setState({ mode: selectedKey });
      }
  }

  renderHeader(){
    const { mode, PathForExplorer, zipPathForOneBook } = this.state;

    if (mode === "home" && PathForExplorer) {
        return  <h4>{PathForExplorer} </h4>;
    } else if(mode === 'onebook') {
        return <h4>{_.getFn(zipPathForOneBook)}</h4>
    }
  }

  getWebTitle() {
    const { mode, PathForExplorer, zipPathForOneBook } = this.state;

    if (mode === "home" && PathForExplorer) {
        return  PathForExplorer;
    } else if (mode === 'onebook') {
        return _.getFn(zipPathForOneBook);
    } else {
        return "comic reader";
    }
  }

  render() {
      const { mode, PathForExplorer } = this.state;
      const that = this;
      let navs = ['home', 'author'];

      document.title = this.getWebTitle();

      if (mode === 'onebook' || (mode === 'home' && PathForExplorer &&  _.getDir(PathForExplorer))) {
          navs = ['back'].concat(navs);
      }

      const listItems = navs.map((item) => (
          <Nav.Item key={item}>
              <Nav.Link
                  className={`app-nav-item app-nav-item-${item}`}
                  src={item}
                  onClick={that.switchMode.bind(that, item)}
              >
                  {item.toUpperCase()}
              </Nav.Link>
          </Nav.Item>
      ));

      return (
          <div className="app-container">
              {this.renderHeader()}
              <Nav fill variant="tabs">
                  {listItems}
              </Nav>
              {this.chooseSubComponent()}
          </div>
      );
  }
}

App.propTypes = {};
