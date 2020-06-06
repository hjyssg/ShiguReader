
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const cachePath = global.cachePath;
const pathUtil = require("../pathUtil");

const deleteEmpty = require('delete-empty');

function doCacheClean(config){
    const cleanCache = require("../../tools/cleanCache");
    try{
        cleanCache.cleanCache(cachePath, config);
    }catch(e){
        console.error(e);
    }
}

router.post('/api/cleanCache', (req, res) => {
    function afterClean() {
        res.sendStatus(200);
    }

    doCacheClean({afterClean: afterClean});

    //delete empty folder
    deleteEmpty(pathUtil.getImgConverterCachePath(), (err, deleted) => {
        if(err){
            console.error(err); 
        }
    });
});

module.exports = router;
