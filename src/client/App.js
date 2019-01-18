import React, { Component } from 'react';
import './style/app.css';
import Home from './Home';
import ImagePage from './ImagePage';
import PropTypes from 'prop-types';

import Button from 'react-bootstrap/lib/Button';
import Nav from 'react-bootstrap/lib/Nav';

const MODES = ["home", "author" ,"tag", "genre", "onebook"]

//http://localhost:3000/
export default class App extends Component {
  state = {  mode:"home" };

  chooseSubComponent(){
    if(this.state.mode === "home"){
      return <Home/>;
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