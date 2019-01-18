import React, { Component } from 'react';

export default class ImagePage extends Component {
  renderFileList(){
      const displayList = this.props.imageList;
      const listItems = displayList.map(function(item){
        return (<li><img src={item} /></li>);
      });
      return (<ul>{listItems}</ul>);
  }

  render() {
    return this.renderFileList();
  }
}
