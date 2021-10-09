
const serverUtil = require("./serverUtil");
const db = require("./models/db");
const util = global.requireUtil();
const path = require('path');
const _ = require('underscore');
const isWindows = require('is-windows');
const pathUtil = require("./pathUtil");
const { isSub } = pathUtil;
const { getCurrentTime } = util;

function isEqual(a, b) {
    a = a || "";
    b = b || "";
    return a.toLowerCase() === b.toLowerCase();
}

function splitRows(rows, text) {
    let zipResult = [];
    let dirResults = [];
    let imgFolders = {};
    const textInLowerCase = text.toLowerCase();

    rows.forEach(row => {
        const dirName = path.basename(row.dirPath);
        const byDir = dirName.toLowerCase().includes(textInLowerCase);
        const byFn = row.fileName.toLowerCase().includes(textInLowerCase);

        if (row.isDisplayableInExplorer && (byFn || byDir)) {
            //for file, its name or its dir name
            zipResult.push(row);
        } else if (row.isDisplayableInOnebook && byDir) {
            imgFolders[dirName] = imgFolders[dirName] || [];
            imgFolders[dirName].push(row.filePath);
        } else if (row.isFolder && byFn) {
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

async function searchOnEverything(text) {
    const everything_connector = require("../tools/everything_connector");
    const etc_config = global.etc_config;
    const port = etc_config && etc_config.everything_http_server_port;
    const { cachePath, thumbnailFolderPath } = global;

    function isNotAllow(fp) {
        const arr = [cachePath, thumbnailFolderPath];
        return arr.some(e => {
            if (isEqual(fp, e) || isSub(e, fp)) {
                return true;
            }
        })
    }

    const config = {
        port,
        filter: (fp, info) => {
            if (isNotAllow(fp)) {
                return false;
            }

            if (info.type === "folder") {
                return true;
            }

            if (util.isDisplayableInExplorer(fp)) {
                return true;
            }
        }
    };


    if (port && isWindows()) {
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
    // let beg = getCurrentTime()
    const fileInfos = {};

    const all_text = tag || author || text;
    let searchEveryPromise;
    if(!onlyNeedFew){
        searchEveryPromise =  searchOnEverything(all_text);
    }

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
        const fp = obj.filePath;
        fileInfos[fp] = db.getFileToInfo(fp);
    })

    if(!onlyNeedFew){
        let esObj = await searchEveryPromise;
        if (esObj) {
            if(author){
                const parse = serverUtil.parse;
                function checkIfPass(fileName, author){
                    const result = parse(fileName);
                    if(!result){
                        return false;
                    }
                    const pass =  isEqual(result.author, author) || 
                                  isEqual(result.group, author) || 
                                  (result.authors && result.authors.includes(author));
                    return pass;
                }
    
                _.keys(esObj.fileInfos).forEach(fileName => {
                    if(!checkIfPass(fileName, author)){
                        delete esObj.fileInfos[fileName]
                    }
                })
                esObj.dirResults = esObj.dirResults.filter(e => checkIfPass(e, author))
            }
            dirResults = _.uniq(dirResults.concat(esObj.dirResults));
            _.extend(fileInfos, esObj.fileInfos)
        }
    }

    // let end = getCurrentTime();
    // console.log((end - beg)/1000, "to search");
    let result = {
        tag,
        author,

        fileInfos,
        imgFolders,
        dirs: dirResults
    }

    const { _decorate } = serverUtil.common;
    result = await _decorate(result);

    return result;
}

module.exports.searchByTagAndAuthor = searchByTagAndAuthor;
