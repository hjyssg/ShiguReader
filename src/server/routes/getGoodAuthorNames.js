

const express = require('express');
const router = express.Router();
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const util = require("../../util");
const { isCompress } = util;
const path = require('path');
const userConfig = require('../../user-config');
const serverUtil = require("../serverUtil");

function getGoodAndOtherSet(){
    const set = {};
    const otherSet = {};
    getAllFilePathes().forEach(p => {
        const ext = path.extname(p).toLowerCase();
        if(isCompress(ext)){
            const temp = serverUtil.parse(p);
            const name = temp && temp.author;
            if(name){
                if(p && p.startsWith(userConfig.good_folder_root)){
                    set[name] = set[name]? set[name]+1: 1;
                }else{
                    otherSet[name] = otherSet[name]? otherSet[name]+1: 1;
                }
            }
        }
    });

    return {
        set,
        otherSet
    }
}

router.get('/api/getGoodAuthorNames',async (req, res) => {
    const result = getGoodAndOtherSet();

    res.send({
        goodAuthors: result.set,
        otherAuthors: result.otherSet
    });
});

module.exports = router;
