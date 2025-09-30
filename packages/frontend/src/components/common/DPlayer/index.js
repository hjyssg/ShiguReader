import React from "react";
import classNames from "classnames";
import DPlayer from "dplayer";

const events = [
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "mozaudioavailable",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "volumechange",
  "waiting",
  "screenshot",
  "thumbnails_show",
  "thumbnails_hide",
  "danmaku_show",
  "danmaku_hide",
  "danmaku_clear",
  "danmaku_loaded",
  "danmaku_send",
  "danmaku_opacity",
  "contextmenu_show",
  "contextmenu_hide",
  "notice_show",
  "notice_hide",
  "quality_start",
  "quality_end",
  "destroy",
  "resize",
  "fullscreen",
  "fullscreen_cancel",
  "subtitle_show",
  "subtitle_hide",
  "subtitle_change"
];

const capitalize = (str) => `${str.charAt(0).toUpperCase()}${str.substring(1)}`;

const capitalizeEventName = (str) => str.split("_").map(capitalize).join("");

const eventsProps = events.map((eventName) => ({
  eventName,
  prop: `on${capitalizeEventName(eventName)}`
}));
const eventPropNames = new Set(eventsProps.map((event) => event.prop));

class DPlayerComponent extends React.Component {
  componentDidMount() {
    const { onLoad, options } = this.props;
    const player = (this.dp = new DPlayer({
      ...Object.assign(
        {},
        {
          lang: "zh-cn",
          contextmenu: [
            {
              text: "Author",
              link: "https://github.com/hnsylitao"
            },
            {
              text: "GitHub",
              link: "https://github.com/MoePlayer/react-dplayer"
            }
          ]
        },
        options
      ),
      container: this.container
    }));

    if (onLoad) {
      onLoad(player);
    }

    eventsProps.forEach(({ eventName, prop }) => {
      if (prop in this.props) {
        player.on(eventName, this.props[prop]);
      }
    });
  }

  componentWillUnmount() {
    if (this.dp) {
      this.dp.destroy();
      this.dp = null;
    }
  }

  render() {
    const { className, ...otherProps } = this.props;
    const resetProps = {};
    Object.keys(otherProps).forEach((key) => {
      if (key !== "options" && key !== "onLoad" && !eventPropNames.has(key)) {
        resetProps[key] = otherProps[key];
      }
    });
    const wrapperClassName = classNames("dplayer", className);

    return (
      <div
        ref={(ref) => {
          this.container = ref;
        }}
        className={wrapperClassName}
        {...resetProps}
      />
    );
  }
}

export default DPlayerComponent;
