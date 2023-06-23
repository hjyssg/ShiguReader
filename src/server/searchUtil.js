
const serverUtil = require("./serverUtil");
const db = require("./models/db");
const util = global.requireUtil();
const path = require('path');
const _ = require('underscore');
const pathUtil = require("./pathUtil");
const { isSub } = pathUtil;
// const { getCurrentTime } = util;

function isEqual(a, b) {
    a = a || "";
    b = b || "";
    return a.toLowerCase() === b.toLowerCase();
}

function splitRows(rows) {
    let zipResult = [];
    let dirResults = [];
    let imgFolders = {};
    // const textInLowerCase = text.toLowerCase();

    //tag不一定出现在文件名里面
    //因为tag是经过处理的

    rows.forEach(row => {
        const dirPath = row.dirPath;
        // const byDir = dirPath.toLowerCase().includes(textInLowerCase);
        // const byFn = row.fileName.toLowerCase().includes(textInLowerCase);

        if (row.isDisplayableInExplorer) {
            zipResult.push(row);
        } else if (row.isDisplayableInOnebook) {
            imgFolders[dirPath] = imgFolders[dirPath] || [];
            imgFolders[dirPath].push(row);
        } else if (row.isFolder) {
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
    const everything_connector = require("./everything_connector");
    const etc_config = global.etc_config;
    const everything_http_server_port = etc_config && etc_config.everything_http_server_port;
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
        everything_http_server_port,
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


    if (everything_http_server_port && global.isWindows) {
        return await everything_connector.searchByText(text, config);
    }
}

async function searchByText(text) {
    // console.log("---" + text)
    // https://www.sqlite.org/optoverview.html
    // console.time();
    // 模糊搜索
    let sql = `SELECT * FROM file_table WHERE fileName LIKE ? or dirName LIKE ? `;
    let rows = await db.doSmartAllSync(sql, ["%" + text + "%", "%" + text + "%"]);
    // console.timeEnd();

    return splitRows(rows);
}

async function _searchByTag_(tag){
    // 严格匹配
    const type = tag? "tag" : "author" ;
    let sql = `SELECT a.* 
        FROM file_table AS a INNER JOIN tag_table AS b 
        ON a.filePath = b.filePath AND b.tag = ? AND b.type =?`;
    let rows = await db.doSmartAllSync(sql, [tag, type]);
    return splitRows(rows);
}

async function searchGenerally(tag, author, text, onlyNeedFew) {
    // let beg = getCurrentTime()
    let fileInfos = {};

    const all_text = tag || author || text;
    let searchEveryPromise;
    if(!onlyNeedFew){
        searchEveryPromise =  searchOnEverything(all_text);
    }

    let zipResult;
    let dirResults;
    let imgFolders;

    if(text){
        const temp = await searchByText(text);
        zipResult = temp.zipResult;
        dirResults = temp.dirResults;
        imgFolders = temp.imgFolders;
    } else {
        const at_text = tag || author;
        if (at_text) {
            const temp = await _searchByTag_(at_text);
            zipResult = temp.zipResult;
            dirResults = temp.dirResults;
            imgFolders = temp.imgFolders;
        }
    }
    fileInfos = serverUtil.convertFileRowsIntoFileInfo(zipResult);


    // filter everything search result
    if(!onlyNeedFew){
        let esObj = await searchEveryPromise;
        if (esObj) {
            if(author){
                const checkIfPass = (fileName, author) => {
                    const result = serverUtil.parse(fileName);
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

    // console.time("decorate");
    result = await serverUtil.common.decorateResWithMeta(result);
    // console.timeEnd("decorate");

    return result;
}


module.exports = {
    searchGenerally,
    searchByText,
    _searchByTag_
}

