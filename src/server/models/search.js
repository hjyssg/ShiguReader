
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getFileCollection } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo }  = zipInfoDb;
const util = global.requireUtil();
const {escapeRegExp} = util;
const path = require('path');
const _ = require('underscore');

function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    let beg = (new Date).getTime()
    const fileInfos = {};

    let results;
    if(text){
        const reg = escapeRegExp(text);
        results = getFileCollection().chain()
                      .find({'fileName': { '$regex' : reg }, isDisplayableInExplorer: true });
    }else if(author){
        const reg = escapeRegExp(author);
        results = getFileCollection().chain()
                      .find({'$or': [{'author': { '$regex' : reg }}, {'group': { '$regex' : reg }}], 
                      isDisplayableInExplorer: true });
    }else if(tag){
        const reg = escapeRegExp(tag);
        results = getFileCollection().chain()
                      .find({'tags': { '$regex' : reg }, isDisplayableInExplorer: true });
    }

    if(onlyNeedFew){
        results = results.limit(5);
    }

    results.data().forEach(obj => {
        const pp = obj.filePath;
        fileInfos[pp] = db.getFileToInfo(pp);
    })

    let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");

    const getThumbnails = serverUtil.common.getThumbnails;
    const files = _.keys(fileInfos);
    return { tag, author, fileInfos, thumbnails: getThumbnails(files), zipInfo: getZipInfo(files) };
}

module.exports = searchByTagAndAuthor;
