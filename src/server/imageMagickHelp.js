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
const filesizeUitl = require('filesize');

function logFail(filePath, e){
    logger.info("[minifyOneFile] cannot ", filePath, e);
}
//https://imagemagick.org/script/download.php#windows

module.exports.minifyOneFile = async function(filePath){
    if (!filePath || !(await isExist(filePath))) {
        logFail(filePath);
        return;
    }

    try{
        const oldStat = await pfs.stat(filePath);
        const files = await listZipContent(filePath);
        //check all content is image
        if(files.some(e => !isImage(e))){
            logFail(filePath);
            return;
        }
        
        //do a brand new extract 
        const bookName = path.basename(filePath, path.extname(filePath)) 
        let extractOutputPath = path.join(getRootPath(), userConfig.workspace_name, "imageMagick_cache" , bookName+"-original");
        let minifyOutputPath = path.join(getRootPath(), userConfig.workspace_name, "imageMagick_cache" , bookName);

        if(!(await isExist(minifyOutputPath))){
            const mdkirErr = await pfs.mkdir(minifyOutputPath);
            if(mdkirErr){
                logFail(filePath, mdkirErr);
                return;
            }
        }

        const { pathes, error } = await extractAll(filePath, extractOutputPath);
        if(error){
            logFail(filePath, error)
        } else {
            //what if unzip reault has a empty foldet along with other images?

            //see if extract success
            //be really careful about data 

            if(pathes.length !== files.length){
                debugger;
                return;
            }

            const hasUnzipError =  pathes.some((e, ii) => {
                return path.basename(e) !== path.basename(files[ii]);
            })
    
            if(hasUnzipError){
                logFail(filePath);
                return;
            }

            console.log("-----begin convert images into webp--------------")

            const total = pathes.length;
            for(let ii = 0; ii < total; ii++){
                const fname = pathes[ii];
                const imgFilePath = path.resolve(extractOutputPath, fname);
                //use imageMagik to convert 
                //  magick 1.jpeg   50 1.webp
                const name = path.basename(fname, path.extname(fname)) + ".webp";
                const outputImgName = path.resolve(minifyOutputPath, name);
                let {stdout, stderr} = await execa("magick", [imgFilePath, "-quality", 50, outputImgName ]);
                console.log(`[magick] ${ii}/${total}`);
                if (stderr) {
                    hasUnzipError = stderr;
                    break;
                } 
            }
  
            if(hasUnzipError){
                logFail(filePath);
                return;
            }
    
            //zip into a new zip file
            let {stdout, stderr, resultZipPath} = await sevenZipHelp.zipOneFolder(minifyOutputPath);
            if(!stderr){
                const newStat = await pfs.stat(resultZipPath);
                console.log("[magick] webp converting done", filePath);
                console.log("original size",filesizeUitl(oldStat.size, {base: 2}));
                console.log("new size", filesizeUitl(newStat.size, {base: 2}));

                const reducePercentage = (100 - newStat.size/oldStat.size * 100).toFixed(2);
                console.log(reducePercentage);

                if(reducePercentage < 10){
                    console.log("not a useful work. abandon");
                }else{
                          //manually let file have the same modify time
                // rename the old file with postfix "-has-minified"
                //move the new file into the same folder as the old one
        
                // err = await pfs.rename(src, dest);
        
                //let user to decide if delete them or not
                    }
            }
    
      
        } 
    }catch(e){
        logFail(filePath, e)
    }
}
