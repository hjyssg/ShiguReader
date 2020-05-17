const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const logger = require("./models/logger").logger;
const util = require("../util");
const pathUtil = require("./pathUtil");
const { isImage } = util;

const sevenZipHelp = require("./sevenZipHelp");
const { listZipContent, extractAll }= sevenZipHelp;

const { isExist, getRootPath } = pathUtil;

const userConfig = require('../user-config');
const filesizeUitl = require('filesize');

const rimraf = require("../tools/rimraf");

const { workspace_name} = userConfig;


function logFail(filePath, e){
    logger.error("[minifyOneFile] cannot ", filePath, e);
    console.error("[minifyOneFile] cannot ", filePath, e);
}

//https://imagemagick.org/script/download.php#windows

async function convertImage(imgFilePath, outputImgName){
    try{
        let {stdout, stderr} = await execa("magick", [imgFilePath, "-quality", 50, outputImgName ]);
        return {stdout, stderr};
    }catch(e){
        logFail("[convertImage]", e);
    }
}


module.exports.minifyOneFile = async function(filePath){
    let extractOutputPath;
    let minifyOutputPath;
    try{
        const oldStat = await pfs.stat(filePath);
        const { files, fileInfos } = await listZipContent(filePath);
        //check all content is image
        const convertable = files.every((e, ii) => {
            if(isImage(e)){
                return true;
            }else if(fileInfos[ii].Folder === "+"){
                return true
            }else{
                return false;
            }
        })

        if(!convertable){
            logFail(filePath);
            return;
        }
        
        //do a brand new extract 
        const bookName = path.basename(filePath, path.extname(filePath)) 
        extractOutputPath = path.join(getRootPath(), workspace_name, "imageMagick_cache" , bookName+"-original");
        minifyOutputPath = path.join(getRootPath(), workspace_name, "imageMagick_cache" , bookName);

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
            //see if extract success
            //be really careful about data 
            if(pathes.length !== files.length){
                logFail(filePath, "extract all missing files")
                return;
            }
            const expect_file_names = files.map(e => path.basename(e)).sort();
            const resulted_file_names =  pathes.map(e => path.basename(e)).sort();
            if(!_.isEqual(resulted_file_names, expect_file_names)){
                logFail(filePath, "extract all missing files");
                return;
            }
        

            console.log("-----begin convert images into webp--------------")
            const _pathes = pathes.filter(isImage);
            const total = _pathes.length;
            let converterError;
            for(let ii = 0; ii < total; ii++){
                const fname = _pathes[ii];
                const imgFilePath = path.resolve(extractOutputPath, fname);
                //use imageMagik to convert 
                //  magick 1.jpeg   50 1.webp
                const name = path.basename(fname, path.extname(fname)) + ".webp";
                const outputImgName = path.resolve(minifyOutputPath, name);
                let {stdout, stderr} = convertImage(imgFilePath, outputImgName);
                console.log(`[magick] ${ii+1}/${total}`);
                if (stderr) {
                    converterError = stderr;
                    break;
                } 
            }
  
            if(converterError){
                logFail(filePath, converterError);
                return;
            }
    
            //zip into a new zip file
            let {stdout, stderr, resultZipPath} = await sevenZipHelp.zipOneFolder(minifyOutputPath);
            if(!stderr){
                const newStat = await pfs.stat(resultZipPath);
                console.log("[magick] convertion done", filePath);
                console.log("original size",filesizeUitl(oldStat.size, {base: 2}));
                console.log("new size", filesizeUitl(newStat.size, {base: 2}));

                const reducePercentage = (100 - newStat.size/oldStat.size * 100).toFixed(2);
                console.log(`size reduce ${reducePercentage}%`);

                if(reducePercentage < 10){
                    console.log("not a useful work. abandon");
                    deleteCache(resultZipPath);
                }else{
                    //manually let file have the same modify time
                    // rename the old file with postfix "-has-minified"
                    //move the new file into the same folder as the old one
            
                    // err = await pfs.rename(src, dest);
            
                    //let user to decide if delete them or not
                }
            }
        } 
    } catch(e) {
        logFail(filePath, e)
    } finally {
        deleteCache(extractOutputPath);
        deleteCache(minifyOutputPath);
    }
}

function deleteCache(filePath){
    if(filePath){
        rimraf(filePath, (err) =>{ 
            if(err){
                console.error("[clean imageMagickHelp]", filePath, err);
            }
        });
    }
}