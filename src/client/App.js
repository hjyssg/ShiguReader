import React, { Component } from 'react';
import './style/app.css';
import _ from "underscore";
import Nav from 'react-bootstrap/lib/Nav';
import ExplorerPage from "./ExplorerPage";
import OneBook from "./OneBook";
import TagPage from "./TagPage";

const userConfig = require('../user-config');

// const MODES = ['home', 'author', 'tag', 'onebook'];

const imageTypes = ['jpg', 'png'];
const compressTypes = ['zip', 'rar'];
_.isImage = function (fn) {
    return imageTypes.some(e => fn.endsWith(e));
};
_.isCompress = function (fn) {
    return compressTypes.some(e => fn.endsWith(e));
};

_.getDir = function (fn) {
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
  state = { mode: 'home' };

  swithToOneBook(zipPath) {
      this.setState({
          mode: 'onebook',
          zipPathForOneBook: zipPath
      });
  }

  chooseSubComponent() {
      const { mode, pathForHome, zipPathForOneBook } = this.state;
      if (mode === "home") {
          return (
              <ExplorerPage
                  ref={homePage => {
                      this.homePage = homePage;
                  }}
                  modeChange={this.swithToOneBook.bind(this)}
                  pathForHome={pathForHome}
                  dirs={userConfig.home_pathes}
              />
          );
      } else if (mode === "onebook") {
          return (<OneBook filePath={zipPathForOneBook} />);
      } else if (mode === "tag") {
          return <TagPage mode="tag" />;
      } else if (mode === "author") {
          return <TagPage mode="author" />;
      } else {
          return (<div>{mode}</div>);
      }
  }

  switchMode(selectedKey) {
      const { mode, zipPathForOneBook } = this.state;
      if (selectedKey === 'back') {
          let p;
          if (mode === 'onebook') {
              p = _.getDir(zipPathForOneBook);
          } else if (mode === 'home') {
              p = _.getDir(this.homePage.state.currentPath);
          }
          this.setState({ mode: 'home', pathForHome: p });
      } else {
          this.setState({ mode: selectedKey });
      }
  }

  render() {
      const { mode } = this.state;
      const that = this;
      let navs = ['home', 'author', 'tag'];

      if (mode === 'onebook' || mode === 'home') {
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
              <Nav fill variant="tabs">
                  {listItems}
              </Nav>
              {this.chooseSubComponent()}
          </div>
      );
  }
}

App.propTypes = {};
