const express = require('express');
const serverUtil = require('../utils/server-util');

const router = express.Router();

const tokenSet = {};

router.post('/api/auth/login', serverUtil.asyncWrapper(async (req, res) => {
    const etcConfig = global.etc_config || {};
    const password = req.body && req.body.password;
    if (password === etcConfig.home_password || !etcConfig.home_password) {
        const token = serverUtil.makeid();
        tokenSet[token] = true;
        res.cookie('login-token', token, { maxAge: 30 * 1000 * 3600 * 24 });
        res.json({
            failed: false,
        });
    } else {
        res.json({
            failed: true,
        });
    }
}));

router.post('/api/auth/logout', serverUtil.asyncWrapper(async (req, res) => {
    const token = req.cookies && req.cookies['login-token'];
    if (token && tokenSet[token]) {
        delete tokenSet[token];
    }
    res.cookie('login-token', '');
    res.send({ failed: false });
}));

module.exports = {
    router,
    tokenSet,
};
