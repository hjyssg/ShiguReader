
const pathUtil = require("../pathUtil");
const isWindows = require('is-windows');
const express = require('express');
const router = express.Router();
const logger = require("../logger");

const isLinux = require("is-linux")
const isOsx = require("is-osx");
const cp = require('child_process');
const util = global.requireUtil();
const { getCurrentTime } = util;

function shutdown(cb) {
    //modify https://github.com/hemanth/power-off/
    let cmd = '';

    if (isLinux() || isOsx()) {
        cmd = 'sudo shutdown -h now';
    } else if (isWindows()) {
        cmd = 'shutdown /s /f';
    } else {
        throw new Error('Unknown OS!');
    }

    cp.exec(cmd, function (err, stdout, stderr) {
        logger.info("[shutdown]", getCurrentTime());
        cb && cb(err, stdout, stderr);
    });
};

router.post('/api/shutdownServer', function (req, res) {
    shutdown();
    res.send({ failed: false });
});

module.exports = router;
