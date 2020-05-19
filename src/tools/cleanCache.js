const fs = require('fs');
const path = require('path');
const rimraf = require("./rimraf");
const util = global.requireUtil();

let counter = 0;
const pathUtil = require("../server/pathUtil");
const {  isSub } = pathUtil;
const serverUtil = require("../server/serverUtil");

const show_error = false;

function del(file, cachePath){
    if(isSub(cachePath, file)){
        rimraf(file, (err) =>{
            if(err){
                // try{
                //     const stat = fs.statSync(file);
                //     if(stat.isFile()){
                //         fs.unlinkSync(file);
                //     } else {
                //         fs.rmdirSync(file);
                //     }
                // }catch(e){
                //     console.error(file, e);
                // }
                show_error && console.error("[cache clean]", err);
            }
        });

        counter++;
        if(counter % 20 === 0){
            console.log("[cache clean] delete:", counter);
        }
    } else {
        throw "try to delete non-cache file";
    }
}

function cleanCache(cachePath, config){
    if(!fs.existsSync(cachePath)){
        err = fs.mkdir(cachePath, (err) => {
            if (err){
                 throw err;
            }
          });
    } else {
        _clean(cachePath, config);
    }
}

function _clean(cachePath, config){
    const folders1 = fs.readdirSync(cachePath);
    //check each file/dir in level 1
    folders1.forEach(fPath => {
        try {
            fPath = path.resolve(cachePath, fPath);
            const stat = fs.statSync(fPath);
            if (stat.isFile()) {
                del(fPath, cachePath);
            }else if(stat.isDirectory()){
                const fileName = path.basename(fPath);
                if(config && config.allowFileNames && !config.allowFileNames.includes(fileName)){
                    del(fPath, cachePath);
                }
                let subfiles = fs.readdirSync(fPath);
                const thumbnail = serverUtil.chooseThumbnailImage(subfiles);
                //only thumbnail
                for(let ii = 0; ii < subfiles.length; ii++){
                    const subfileName = subfiles[ii];
                    const filePath = path.resolve(fPath, subfileName);

                    //compress first image to standard thumbnail
                    if(subfileName === thumbnail){
                        if(config.minized){
                            const thumbnailGenerator = require("./thumbnailGenerator");
                            thumbnailGenerator(fPath, subfileName, (err, info) => { 
                                if(!err){
                                    del(filePath, cachePath);
                                }
                             });
                        }
                    }else{
                        //del the rest
                        del(filePath, cachePath);
                    }
                }
            }
        }catch(e){
            show_error && console.error("[cache clean] error",e);
        }
    });
    console.log("[cache clean] done");
    config.afterClean &&  config.afterClean();
}

module.exports.cleanCache = cleanCache;