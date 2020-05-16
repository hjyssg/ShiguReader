const fs = require('fs');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const isWindows = require('is-windows');
const logger = require("./models/logger").logger;
const util = require("../util");
const pathUtil = require("./pathUtil");
const { isImage } = util;

const sevenZipHelp = require("./sevenZipHelp");
const { listZipContent, extractAll }= sevenZipHelp;

const { isExist, getRootPath } = pathUtil;

const userConfig = require('../user-config');
const serverUtil = require("./serverUtil");

function logFail(filePath, e){
    logger.info("[minifyOneFile] cannot ", filePath, e);
}

module.exports.minifyOneFile = async function(filePath){
    if (!filePath || !(await isExist(filePath))) {
        logFail(filePath);
        return;
    }

    try{
        const oldStat = await pfs.getStat(filePath);
        const files = await listZipContent(filePath);
        if(files.some(e => !isImage(e))){
            logFail(filePath);
            return;
        }
    
        let outputPath = path.join(getRootPath(), userConfig.workspace_name, "imageMagick" , path.basename(filePath));
    
        //do a brand new extract 
        const { pathes, error } = await extractAll(filePath, outputPath);
        if(error){
            logFail(filePath, error)
        } else {
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
        } 
    }catch(e){
        logFail(filePath, e)
    }
}
