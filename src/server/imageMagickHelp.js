const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const logger = require("./models/logger").logger;
const util = require("../util");
const pathUtil = require("./pathUtil");
const { isImage, getCurrentTime, isGif } = util;

const sevenZipHelp = require("./sevenZipHelp");
const { listZipContent, extractAll }= sevenZipHelp;

const { isExist, getRootPath } = pathUtil;

const userConfig = require('../user-config');
const filesizeUitl = require('filesize');

const rimraf = require("../tools/rimraf");

const { img_convert_cache, img_convert_quality, img_convert_dest_type, img_reduce_resolution_threshold, img_reduce_resolution_dimension } = userConfig;


function logFail(filePath, e){
    logger.error("[minifyOneFile]", filePath, e);
    console.error("[minifyOneFile]", filePath, e);
}

//https://imagemagick.org/script/download.php#windows

async function convertImage(imgFilePath, outputImgName, oldAvgImgSize){
    try{
        let opt;

        if(oldAvgImgSize > img_reduce_resolution_threshold*1024*1024){
            opt = [imgFilePath, "-strip", "-quality", img_convert_quality, "-resize", `${img_reduce_resolution_dimension}\>`, outputImgName ]
        }else{
            opt = [imgFilePath, "-strip", "-quality", img_convert_quality, outputImgName ]
        }

        let {stdout, stderr} = await execa("magick", opt);
        return {stdout, stderr};
    }catch(e){
        logFail("[convertImage]", e);
    }
}

//ONLY KEEP THE CORRECT FILES IN FOLDER AFTER EVERYTHING
module.exports.minifyOneFile = async function(filePath){
    let extractOutputPath;
    let minifyOutputPath;
    try{
        const oldStat = await pfs.stat(filePath);
        const oldTemp = await listZipContent(filePath);
        const oldFiles = oldTemp.files;
        const oldInfos = oldTemp.info;
        const oldAvgImgSize  = oldInfos.avgImgSize;

        //check all content is image or folder
        //gif is not allowed
        const convertable = oldFiles.every((e, ii) => {
            if(e && isImage(e) && !isGif(e)){
                return true;
            }else if(oldFileInfos[ii].folder === "+"){
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
        const convertSpace = path.join(getRootPath(), userConfig.workspace_name, img_convert_cache);
        extractOutputPath = path.join(convertSpace, bookName+"-original");
        minifyOutputPath = path.join(convertSpace, bookName);

        if(!(await isExist(minifyOutputPath))){
            const mdkirErr = await pfs.mkdir(minifyOutputPath, { recursive: true});
            if(mdkirErr){
                logFail(filePath, mdkirErr);
                return;
            }
        }

        const { pathes, error } = await extractAll(filePath, extractOutputPath);
        if(error){
            logFail(filePath, error)
        } else {
            checkExtractAllWithOriginalFiles(pathes, oldFiles);

            console.log("-----begin convert images into webp--------------");
            console.log(filePath);
            const _pathes = pathes.filter(isImage);
            const total = _pathes.length;
            let converterError;
            const beginTime = getCurrentTime();
            for(let ii = 0; ii < total; ii++){
                const fname = _pathes[ii];
                const imgFilePath = path.resolve(extractOutputPath, fname);
                //use imageMagik to convert 
                //  magick 1.jpeg   50 1.webp
                const name = path.basename(fname, path.extname(fname)) + img_convert_dest_type;
                const outputImgName = path.resolve(minifyOutputPath, name);
                let {stdout, stderr} = await convertImage(imgFilePath, outputImgName, oldAvgImgSize);
                if (stderr) {
                    converterError = stderr;
                    break;
                }else{
                    const timeSpent = getCurrentTime() - beginTime;
                    const timePerImg = timeSpent/(ii+1)/1000; // in second
                    const remaintime = (total - ii) * timePerImg;
                    if(ii+1 < total){
                        console.log(`[magick] ${ii+1}/${total} ${(timePerImg).toFixed()} second per file`);
                        console.log(`${remaintime.toFixed()} second before finish`)
                    }
                    else {
                        console.log(`[magick] ${ii+1}/${total}`);
                        // console.log("[magick] finish convertion. going to check if there is any error")
                    }
                }
            }
  
            if(converterError){
                logFail(filePath, converterError);
                return;
            }
    
            //zip into a new zip file
            //todo: The process cannot access the file because it is being used by another process
            let {stdout, stderr, resultZipPath} = await sevenZipHelp.zipOneFolder(minifyOutputPath);
            if(stderr){
                deleteCache(resultZipPath);
            }else{
                const temp = await listZipContent(resultZipPath);
                const filesInNewZip = temp.files;
                if(checkNewZipWithOriginalFiles(filesInNewZip, oldFiles)){
                    console.error("filesInNewZip is missing files");
                    deleteCache(resultZipPath);
                }else{
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
                        const error  = await pfs.utimes(resultZipPath, oldStat.atime , oldStat.mtime);
                        if(error){
                            logFail(filePath, "pfs.utimes failed");
                        } else {
                            console.log("output file is at", convertSpace);
                        }
                    }
                }
            }
        } 
    } catch(e) {
        logFail(filePath, e);
    } finally {
        //maybe let user to delete file manually?
        deleteCache(extractOutputPath);
        deleteCache(minifyOutputPath);
        console.log("------------------------------");
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

function checkExtractAllWithOriginalFiles(newFiles, files, callback){
    if(!newFiles){
        callback && callback();
        throw "[ExtractAll] missing files";
    }

    const expect_file_names = files.filter(isImage).map(e => path.basename(e)).sort();
    const resulted_file_names =  newFiles.filter(isImage).map(e => path.basename(e)).sort();
    if(!_.isEqual(resulted_file_names, expect_file_names)){
        callback && callback();
        throw "[ExtractAll] missing files";
    }
}

function getFn(e){
    return path.basename(e, path.extname(e));
}

function checkNewZipWithOriginalFiles(newFiles, files){
    if(!newFiles){
        return true;
    }

    const expect_file_names = files.filter(isImage).map(getFn).sort();
    const resulted_file_names =  newFiles.filter(isImage).map(getFn).sort();
    if(!_.isEqual(resulted_file_names, expect_file_names)){
        return true;
    }
}