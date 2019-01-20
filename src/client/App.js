import React, { Component } from 'react';
import './style/app.css';
import _ from "underscore";
import Nav from 'react-bootstrap/lib/Nav';
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import TabPage from "./TabPage";
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

      pathForHome: "",
      dirsForHome: userConfig.home_pathes,
      filesForHome: [],

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
        pathForHome: path,
        dirsForHome: dirs,
        filesForHome: files
    });
  }

  chooseSubComponent() {
      const { mode, dirsForHome, filesForHome, zipPathForOneBook } = this.state;
      if (mode === "home") {
          return (
              <ExplorerPage
                  ref={homePage => {
                      this.homePage = homePage;
                  }}
                  dirs={dirsForHome}
                  files={filesForHome}
                  openDirFunc={this.openDirFunc.bind(this)}
                  openBookFunc={this.openBookFunc.bind(this)}
              />
          );
      } else if (mode === "onebook") {
          return (<OneBook filePath={zipPathForOneBook} />);
      } else if (mode === "tag") {
          return <TabPage mode="tag" />;
      } else if (mode === "author") {
          return <TabPage mode="author"  openDirFunc={this.openDirFunc.bind(this)} />;
      } else {
          return (<div>{mode}</div>);
      }
  }

  changeExplorerPath(dir) {
    Sender.lsDir({ dir }, res => {
        if (!res.failed) {
          this.setState({ mode: 'home'});
          this.openDirFunc(dir, res.dirs, res.files);
        }
    });
  }

  handleBackButton(){
    const { mode, zipPathForOneBook, pathForHome } = this.state;
    let p;
    if (mode === 'onebook') {
        p = _.getDir(zipPathForOneBook);
        this.changeExplorerPath(p);
    } else if (mode === 'home') {
        p = _.getDir(pathForHome);
        this.changeExplorerPath(p);
    }
  }

  switchMode(selectedKey) {
      if (selectedKey === 'back') {
        this.handleBackButton();
      } else if (selectedKey === "home") {
        this.setState({
          mode: 'home',
          pathForHome: "",
          dirsForHome: userConfig.home_pathes,
          filesForHome: [],
          zipPathForOneBook: ""
        });
      } else {
          this.setState({ mode: selectedKey });
      }
  }

  renderHeader(){
    const { mode, pathForHome, zipPathForOneBook } = this.state;

    if (mode === "home" && pathForHome) {
        return  <h4>{pathForHome} </h4>;
    } else if(mode === 'onebook') {
        return <h4>{_.getFn(zipPathForOneBook)}</h4>
    }
  }

  getWebTitle() {
    const { mode, pathForHome, zipPathForOneBook } = this.state;

    if (mode === "home" && pathForHome) {
        return  pathForHome;
    } else if (mode === 'onebook') {
        return _.getFn(zipPathForOneBook);
    } else {
        return "comic reader";
    }
  }

  render() {
      const { mode, pathForHome } = this.state;
      const that = this;
      let navs = ['home', 'author'];

      document.title = this.getWebTitle();

      if (mode === 'onebook' || (mode === 'home' && pathForHome &&  _.getDir(pathForHome))) {
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
