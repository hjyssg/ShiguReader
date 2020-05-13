
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const util = require("../../util");
const path = require('path');
const parse = serverUtil.parse;
const nameParser = require('../../name-parser');
const includesWithoutCase =  nameParser.includesWithoutCase;

function isEqual(s1, s2){
    return s1 && s2 && s1.toLowerCase() === s2.toLowerCase();
}

function isSimilar(s1, s2){
    const MIN_AUTHOR_TEXT_LENGTH = 3;
    if(s1 && s2 && s2 > MIN_AUTHOR_TEXT_LENGTH){
        return s1.toLowerCase().includes(s2.toLowerCase()) && Math.abs(s1.length - s2.length) < 3;
    }

    return false;
}

function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    // let beg = (new Date).getTime()
    const files = [];
    const fileInfos = {};
    let _break;
    getAllFilePathes().forEach(path => {
        if(_break){
            return;
        }

        const info = db.getFileToInfo()[path];
        const result = (author || tag) && parse(path);
        //sometimes there are mulitple authors for one book
        if (result && author &&  
            (isEqual(result.author, author) || isEqual(result.group, author) || isSimilar(result.author, author))) {
            files.push(path);
            fileInfos[path] = info;
        } else if (result && tag && includesWithoutCase(result.tags, tag)) {
            files.push(path);
            fileInfos[path] = info;
        }else if (text && path.toLowerCase().indexOf(text.toLowerCase()) > -1) {
            files.push(path);
            fileInfos[path] = info;
        }

        if (onlyNeedFew && files.length > 5) {
            _break = true;
        }
    });
   
    // let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");
    const getZipInfo = serverUtil.common.getZipInfo;
    const getThumbnails = serverUtil.common.getThumbnails;

    return { files, tag, author, fileInfos, thumbnails: getThumbnails(files), zipInfo: getZipInfo(files) };
}

module.exports = searchByTagAndAuthor;
