const fs = require('fs');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const pLimit = require('p-limit');
const isWindows = require('is-windows');
const zipInfoDb = require("./models/zipInfoDb");
const { updateZipDb }  = zipInfoDb;
const logger = require("./models/logger").logger;
const util = require("../util");
const pathUtil = require("./pathUtil");
const { isImage, isCompress, isMusic, isVideo, arraySlice, getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;
const { generateContentUrl } = pathUtil;

const sevenZipHelp = require("./sevenZipHelp");
const { sevenZip, get7zipOption , listZipContent, extractAll, extractByRange }= sevenZipHelp;

const pathUtil = require("./pathUtil");
const {
    fullPathToUrl,
    generateContentUrl,
    isExist,
} = pathUtil;

const db = require("./models/db");
const getCacheOutputPath = db.getCacheOutputPath;

const serverUtil = require("../serverUtil");
const cachePath = serverUtil.common.cachePath;

function logFail(filePath){
    logger.info("[minifyOneFile] cannot ", filePath);
}

module.exports.minifyOneFile = async function(filePath){
    if (!filePath || !(await isExist(filePath))) {
        logFail(filePath);
        return;
    }


    const oldStat = await pfs.getStat(filePath);

    const files = await listZipContent(filePath);
    if(files.some(e => !isImage(e))){
        logFail(filePath);
        return;
    }

    let outputPath = getCacheOutputPath(cachePath, filePath)+"-for-image-magic";

    //do a brand new extract 
    const { pathes, error } = await extractAll(filePath, outputPath);
    if(!error && pathes){
        //see if extract success
        const hasUnzipError =  pathes.some((e, ii) => {
            return path.basename(e) !== path.basename(files[ii]);
        })

        if(hasUnzipError){
            logFail(filePath);
            return;
        }

        //use imageMagik to convert 
        //  magick 1.jpeg  -quality 50 1.webp


        //after done 
        //zip into a new zip file

        //

        //manually let file have the same modify time
        // rename the old file with postfix "-has-minified"
        //move the new file into the same folder as the old one

        // err = await pfs.rename(src, dest);

        //let user to decide if delete them or not
    } else {
       //handleFail
    }
}
