
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

function isEqual(a, b){
    a = a || "";
    b = b || "";
    return a.toLowerCase() === b.toLowerCase();
}

function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    let beg = (new Date).getTime()
    const fileInfos = {};

    let results;
    let extraResults = [];
    let dirResults;
    if(text){
        const textInLowerCase = text.toLowerCase();
        const reg = escapeRegExp(text);
        results = getFileCollection().chain()
                      .find({'fileName': { '$regex' : reg }, isDisplayableInExplorer: true });

        dirResults = getFileCollection().chain()
                      .find({'filePath': { '$regex' : reg }, isDisplayableInExplorer: true })
                      .where(obj => {
                          const fp =  path.dirname(obj.filePath);
                          return fp.toLowerCase().includes(textInLowerCase);
                      }).data();
    }else if(author){
        const reg = escapeRegExp(author);
        let groups = [];

        results = getFileCollection().chain()
                      .find({'$or': [{'authors': { '$regex' : reg }}, {'group': { '$regex' : reg }}], 
                      isDisplayableInExplorer: true })
                      .where(obj => {
                        const result = parse(obj.fileName);
                        const pass =  isEqual(result.author, author) || isEqual(result.group, author) || (result.authors && result.authors.includes(author));
                        if(pass && result.group){
                            //find out which group this author belong
                            groups.push(result.group);
                        }
                        return pass;
                      });

        if(groups.length > 0){
            const byFeq = _.countBy(groups, e => e);
            groups = _.sortBy(_.keys(byFeq), e => -byFeq[e]);
            extraResults = getFileCollection().find({'authors': groups[0] , 
                                                     'group': {'$len': 0 }, 
                                                     isDisplayableInExplorer: true });
        }
    }else if(tag){
        const reg = escapeRegExp(tag);
        results = getFileCollection().chain()
                      .find({'tags': { '$regex' : reg }, isDisplayableInExplorer: true })
                      .where(obj => {
                        const tagArr = obj.tags.split(serverUtil.sep);
                        return tagArr.some(e => isEqual(tag, e));
                      });
    }

    if(onlyNeedFew){
        results = results.limit(5);
    }

    let finalResult = (results && results.data())||[];
    finalResult = finalResult.concat(extraResults);

    finalResult.forEach(obj => {
        const pp = obj.filePath;
        fileInfos[pp] = db.getFileToInfo(pp);
    })

    let _dirs = dirResults && dirResults.map(obj =>{
        const parentPath = path.resolve(obj.filePath, "..");
        return parentPath;
    });
    _dirs = _dirs && _.unique(_dirs);

    let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");

    const getThumbnails = serverUtil.common.getThumbnails;
    const files = _.keys(fileInfos);
    return { tag, author, fileInfos, dirs: _dirs, thumbnails: getThumbnails(files), zipInfo: getZipInfo(files) };
}

module.exports = searchByTagAndAuthor;
