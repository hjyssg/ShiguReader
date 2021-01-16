
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const path = require('path');
const _ = require('underscore');
const isWindows = require('is-windows');


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

async function searchOnEverything(text){
    const everything_connector = require("../../tools/everything_connector");	
    const etc_config = global.etc_config;
    const port = etc_config && etc_config.everything_http_server_port;
    const {cachePath, thumbnailFolderPath} = global;

    const config = {	
        port,
        filter: (fp) => {
            if(fp.includes(cachePath) || fp.includes(thumbnailFolderPath)){
                return false;
            }
            if(util.isDisplayableInExplorer(fp)){
                return true;
            }
        }
    };

    
    if(port && isWindows()){
        return await everything_connector.searchByText(text, config);
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

    const all_text = tag || author || text;
    let temp = await searchByText(all_text);
    let zipResult = temp.zipResult;
    let dirResults = temp.dirResults;
    let imgFolders = temp.imgFolders;

    const at_text = tag || author;
    if (at_text) {
        const sqldb = db.getSQLDB();
        //inner joiner then group by
        let sql = `SELECT a.* ` 
        + `FROM file_table AS a INNER JOIN tag_table AS b `
        + `ON a.filePath = b.filePath AND INSTR(b.tag, ?) > 0`;
        let rows = await sqldb.allSync(sql, [at_text]);
        const tag_obj = splitRows(rows, at_text);
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

    let esObj = await searchOnEverything(all_text);
    if(esObj){
        dirResults = _.uniq(dirResults.concat(esObj.dirResults));
        _.extend(fileInfos, esObj.fileInfos)
    }


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
