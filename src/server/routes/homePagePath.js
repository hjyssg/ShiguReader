
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getFileCollection } = db;
const util = global.requireUtil();
const {escapeRegExp} = util;

router.post('/api/homePagePath', function (req, res) {
    let result = global.path_will_scan;
    result = result.filter(e => {
        if(e){
            const reg = escapeRegExp(e);
            //check if pathes really exist by checking there is file in the folder
            return !!getFileCollection().findOne({'filePath': { '$regex' : reg }, isDisplayableInExplorer: true });
        }
    });

    if(result.length === 0){
        console.error("Please check path-config");
        res.sendStatus(404);
    }else{
        res.send({
            dirs: result
        })
    }
});
module.exports = router;
