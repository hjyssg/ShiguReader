
const serverUtil = require("./server-util");
const { decorateResWithMeta } = require('../services/server-common');
const db = require("../models/db");
const _ = require('underscore');

function splitRows(rows) {
    let explorerfileResult = [];
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
            explorerfileResult.push(row);
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
        explorerfileResult,
        dirResults,
        imgFolders
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

async function _searchByTag_(tag, type){
    // 严格匹配
    let sql = `SELECT a.* 
        FROM file_table AS a INNER JOIN tag_file_table AS b 
        ON a.filePath = b.filePath AND b.tag = ? AND b.type =?`;
    let rows = await db.doSmartAllSync(sql, [tag, type]);
    return splitRows(rows);
}

async function searchGenerally(tag, author, text) {
    // let beg = getCurrentTime()
    let fileInfos = {};
    let explorerfileResult = [];
    let dirResults = [];
    let imgFolders = {};

    if (text) {
        ({ explorerfileResult, dirResults, imgFolders } = await searchByText(text));
    } else {
        const at_text = tag || author;
        if (at_text) {
            ({ explorerfileResult, dirResults, imgFolders } = await _searchByTag_(
                at_text,
                tag ? 'tag' : 'author',
            ));
        }
    }
    fileInfos = serverUtil.convertFileRowsIntoFileInfo(explorerfileResult);

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
    result = await decorateResWithMeta(result);
    // console.timeEnd("decorate");

    return result;
}


module.exports = {
    searchGenerally,
    searchByText,
    _searchByTag_
}

