

const express = require('express');
const router = express.Router();
const db = require("../models/db");
const { loopEachFileInfo } = db;
const util = global.requireUtil();
const { isCompress } = util;
const userConfig = global.requireUserConfig();
const serverUtil = require("../serverUtil");

function getGoodAndOtherSet(){
    let beg = (new Date).getTime();

    //todo this takes 0.15s
    //too slow

    const set = {};
    const otherSet = {};
    loopEachFileInfo(p => {
        if(isCompress(p)){
            const temp = serverUtil.parse(p);
            const name = temp && temp.author;
            if(name){
                if(p.startsWith(userConfig.good_folder_root)){
                    set[name] = set[name]? set[name]+1: 1;
                }else{
                    otherSet[name] = otherSet[name]? otherSet[name]+1: 1;
                }
            }
        }
    });

    let end1 = (new Date).getTime();
    console.log(`${(end1 - beg)/1000}s to getGoodAndOtherSet`);

    return {
        set,
        otherSet
    }
}

router.post('/api/getGoodAuthorNames',async (req, res) => {
    const result = getGoodAndOtherSet();

    res.send({
        goodAuthors: result.set,
        otherAuthors: result.otherSet
    });
});

module.exports = router;
