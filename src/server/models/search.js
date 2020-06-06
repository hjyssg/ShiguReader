
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
    let extraResults = [];
    if(text){
        const reg = escapeRegExp(text);
        results = getFileCollection().chain()
                      .find({'fileName': { '$regex' : reg }, isDisplayableInExplorer: true });
    }else if(author){
        const reg = escapeRegExp(author);
        let groups = [];

        results = getFileCollection().chain()
                      .find({'$or': [{'authors': { '$regex' : reg }}, {'group': { '$regex' : reg }}], 
                      isDisplayableInExplorer: true })
                      .where(obj => {
                        const result = parse(obj.fileName);
                        const pass =  result.author === author || result.group === author || (result.authors && result.authors.includes(author));
                        if(pass && result.group){
                            //find out which group this author belong
                            groups.push(result.group);
                        }
                        return pass;
                      });

        if(groups.length > 0){
            groups = _.sortBy(groups, e => e.length);
            const reg2 = escapeRegExp(groups[0]);
            extraResults = getFileCollection().find({'authors': { '$regex' : reg2 }, isDisplayableInExplorer: true });
        }

        
    }else if(tag){
        const reg = escapeRegExp(tag);
        results = getFileCollection().chain()
                      .find({'tags': { '$regex' : reg }, isDisplayableInExplorer: true });
    }

    if(onlyNeedFew){
        results = results.limit(5);
    }

    const finalResult = results.data().concat(extraResults);

    finalResult.forEach(obj => {
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
