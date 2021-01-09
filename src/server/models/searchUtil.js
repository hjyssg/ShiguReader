
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const path = require('path');
const _ = require('underscore');

function isEqual(a, b) {
    a = a || "";
    b = b || "";
    return a.toLowerCase() === b.toLowerCase();
}

function splitRows(rows, text){
    let zipResult = [];
    let dirResults = [];
    let imgFolders = {};
    const textInLowerCase = text.toLowerCase();

    rows.forEach(row => {
        const dirName = path.basename(row.dirPath);
        const byDir = dirName.toLowerCase().includes(textInLowerCase);
        const byFn = row.fileName.toLowerCase().includes(textInLowerCase);

        if(row.isDisplayableInExplorer && (byFn || byDir )){
            //for file, its name or its dir name
            zipResult.push(row);
        }else if(row.isDisplayableInOnebook && byDir){
            imgFolders[dirName] = imgFolders[dirName] || [];
            imgFolders[dirName].push(row.filePath);
        }else if(row.isFolder && byFn){
            //folder check its name 
            dirResults.push(row);
        } 
    })

    dirResults = dirResults.map(obj => { return obj.filePath; });
    dirResults = _.unique(dirResults);

    return {
        zipResult,
        dirResults,
        imgFolders
    }
}

async function searchByText(text) {
    const sqldb = db.getSQLDB();
    let sql = `SELECT * FROM file_table WHERE INSTR(filePath, ?) > 0`;
    let rows = await sqldb.allSync(sql, [text]);
    return splitRows(rows, text);
}

async function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    let beg = (new Date).getTime()
    const fileInfos = {};

    let temp = await searchByText(tag || author || text);
    let zipResult = temp.zipResult;
    let dirResults = temp.dirResults;
    let imgFolders = temp.imgFolders;

    if (tag || author) {
        const sqldb = db.getSQLDB();
        const _text = tag || author;
        //inner joiner then group by
        let sql = `SELECT a.* ` 
        + `FROM file_table AS a INNER JOIN tag_table AS b `
        + `ON a.filePath = b.filePath AND INSTR(b.tag, ?) > 0`;
        let rows = await sqldb.allSync(sql, [_text]);
        const tag_obj = splitRows(rows, _text);
        zipResult = tag_obj.zipResult;
        dirResults = tag_obj.dirResults;
        imgFolders = tag_obj.imgFolders;
    }

    zipResult.forEach(obj => {
        const pp = obj.filePath;
        fileInfos[pp] = db.getFileToInfo(pp);
    })

   

    let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");

    const imgFolderInfo = getImgFolderInfo(imgFolders);

    const { getThumbnails } = serverUtil.common;
    const files = _.keys(fileInfos);
    return {
        tag, author, fileInfos,
        imgFolders, imgFolderInfo,
        dirs: dirResults, 
        thumbnails: getThumbnails(files), 
        zipInfo: getZipInfo(files)
    };
}

module.exports = searchByTagAndAuthor;
