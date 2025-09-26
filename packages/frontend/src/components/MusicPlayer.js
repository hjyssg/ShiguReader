import React, { Component } from 'react';
import PropTypes from 'prop-types';
import '@styles/MusicPlayer.scss';
const classNames = require('classnames');
const util = require("@common/util");
const clientUtil = require("@utils/clientUtil");
const { getDir, getBaseName, getFileUrl } = clientUtil;

export default class MusicPlayer extends Component {
    constructor(prop) {
        super(prop);
        this.state = {
            index: 0
        };
    }

    bindEvent() {
        const that = this;
        this.refs.audio.addEventListener('ended', () => {
            let next = that.state.index + 1;
            if (next === that.props.audioFiles.length) {
                next = 0;
            }
            that.handleIndexChange(next);
        });
    }

    componentDidMount() {
        this.bindEvent();
    }

    componentDidUpdate() {

    }

    handleIndexChange(index) {
        this.setState({ index }, () => {
            this.refs.audio.pause();
            this.refs.audio.load();
            this.refs.audio.play();
        });
    }

    render() {
        const { audioFiles, className } = this.props;
        const { index } = this.state;
        const audioItems = audioFiles.map((e, ii) => {
            const cn = classNames("aji-music-player-item", {
                "aji-music-player-active  fas fa-volume-up": ii === index
            })
            return (<div key={e} className={cn} onClick={this.handleIndexChange.bind(this, ii)} title={getBaseName(e)}> {getBaseName(e)} </div>)
        });

        if (audioFiles.length === 0) {
            return (<div> NO AUDIO FILES </div>);
        }

        //https://stackoverflow.com/questions/43577182/react-js-audio-src-is-updating-on-setstate-but-the-audio-playing-doesnt-chang

        const totalCn = classNames("aji-music-player", className);

        return (
            <div className={totalCn}>
                <div className="aji-music-items">
                    {audioItems}
                </div>
                <audio className="aji-music-player-control" controls ref="audio">
                    <source src={getFileUrl(audioFiles[index])} />
                </audio>
            </div>
        )
    }
}

MusicPlayer.propTypes = {
    audioFiles: PropTypes.arrayOf(PropTypes.string)
};
