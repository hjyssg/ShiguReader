
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getFileCollection, getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const { escapeRegExp } = util;
const path = require('path');
const _ = require('underscore');

function isEqual(a, b) {
    a = a || "";
    b = b || "";
    return a.toLowerCase() === b.toLowerCase();
}

function searchImgFolder(tag, author, text) {
    let imgFolders = {};
    const text2 = tag || author || text;
    const text2InLowerCase = text2.toLowerCase();
    const reg2 = escapeRegExp(text2);
    const img_files_results = getFileCollection()
        .chain()
        .find({ 'filePath': { '$regex': reg2 }, isDisplayableInOnebook: true })
        .where(obj => {
            const fp = path.dirname(obj.filePath);
            return fp.toLowerCase().includes(text2InLowerCase);
        })
        .data();

    img_files_results.forEach(obj => {
        //reduce by its parent folder
        const pp = path.dirname(obj.filePath);
        imgFolders[pp] = imgFolders[pp] || [];
        imgFolders[pp].push(obj.filePath);
    });

    return imgFolders;
}

async function searchByText(text) {
    const textInLowerCase = text.toLowerCase();
    const reg = escapeRegExp(text);

    const sqldb = db.getSQLDB();
    let sql = `SELECT * FROM file_table WHERE filePath LIKE ?`;
    let rows = await sqldb.allSync(sql, [( '%' + text + '%')]);

    let zipResult = [];
    let dirResults = [];
    let imgFolders = {};

    rows.forEach(row => {
        if(row.isDisplayableInExplorer){
            zipResult.push(row);
        }else if(row.isDisplayableInOnebook){
            const fp = path.dirname(row.filePath);
            if(fp.toLowerCase().includes(textInLowerCase)){
                const fp = path.dirname(obj.filePath);
                imgFolders[fp] = imgFolders[fp] || [];
                imgFolders[fp].push(obj.filePath);
            }
        }else {
            dirResults.push(row);
        }
    })

    return {
        zipResult,
        dirResults,
        imgFolders
    }
}

async function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    let beg = (new Date).getTime()
    const fileInfos = {};

 
    const fileCollection = getFileCollection();

    let temp = await searchByText(tag || author || text);
    let zipResult = temp.zipResult;
    let dirResults = temp.zipResult;
    const imgFolders = temp.imgFolders;

    if (author) {
        const reg = escapeRegExp(author);
        let groups = [];

        results = fileCollection.chain()
            .find({
                '$or': [{ 'authors': { '$regex': reg } }, { 'group': { '$regex': reg } }],
                isDisplayableInExplorer: true
            })
            .where(obj => {
                const result = parse(obj.fileName);
                const pass = isEqual(result.author, author) || isEqual(result.group, author) || (result.authors && result.authors.includes(author));
                if (pass && result.group) {
                    //find out which group this author belong
                    groups.push(result.group);
                }
                return pass;
            });

        let extraResults = [];
        if (groups.length > 0) {
            const byFeq = _.countBy(groups, e => e);
            groups = _.sortBy(_.keys(byFeq), e => -byFeq[e]);
            extraResults = fileCollection.find({
                'authors': groups[0],
                'group': { '$len': 0 },
                isDisplayableInExplorer: true
            });
        }

        zipResult = (results && results.data()) || [];
        zipResult = zipResult.concat(extraResults);

    } else if (tag) {
        const reg = escapeRegExp(tag);
        results = fileCollection.chain()
            .find({ 'tags': { '$regex': reg }, isDisplayableInExplorer: true })
            .where(obj => {
                const tagArr = obj.tags.split(serverUtil.sep);
                return tagArr.some(e => isEqual(tag, e));
            });

        zipResult = (results && results.data()) || [];
    }

    zipResult.forEach(obj => {
        const pp = obj.filePath;
        fileInfos[pp] = db.getFileToInfo(pp);
    })

    let _dirs = dirResults && dirResults.map(obj => {
        const parentPath = path.resolve(obj.filePath, "..");
        return parentPath;
    });
    _dirs = _dirs && _.unique(_dirs);

    let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");

    const imgFolderInfo = getImgFolderInfo(imgFolders);

    const getThumbnails = serverUtil.common.getThumbnails;
    const files = _.keys(fileInfos);
    return {
        tag, author, fileInfos,
        imgFolders, imgFolderInfo,
        dirs: _dirs, thumbnails: getThumbnails(files), zipInfo: getZipInfo(files)
    };
}

module.exports = searchByTagAndAuthor;
