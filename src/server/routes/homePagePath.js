
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getAllFilePathes } = db;;
const path_will_scan = serverUtil.common.path_will_scan;

router.post('/api/homePagePath', function (req, res) {
    let homepathes = path_will_scan;
    //check if pathes really exist
    const allfp = getAllFilePathes();
    homepathes = homepathes.filter(e => {
       //there is file in the folder
       return e && allfp.some(fp => (fp.length > e.length && fp.includes(e)));
    });

    if(homepathes.length === 0){
        console.error("Please check userConfig.js home_pathes");
        res.sendStatus(404);
    }else{
        res.send({
            dirs: homepathes
        })
    }
});
module.exports = router;
