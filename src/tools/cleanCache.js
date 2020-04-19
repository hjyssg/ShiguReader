const fs = require('fs');
const path = require('path');
const rimraf = require("./rimraf");
const util = require("../util");
const sharp = require('sharp');

let counter = 0;

function isSubDirectory(parent, child) {
    return path.relative(child, parent).startsWith('..');
}

const show_error = false;

function del(file, cachePath){
    if(isSubDirectory(cachePath, file)){
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

function cleanCache(cachePath, minized){
    if(!fs.existsSync(cachePath)){
        err = fs.mkdir(cachePath, (err) => {
            if (err){
                 throw err;
            }
          });
    } else {
        _clean(cachePath, minized);
    }
}

const POST_FIX = "---thumbnail";

function _clean(cachePath, minized){
    const folders1 = fs.readdirSync(cachePath);
    //check each file/dir in level 1
    folders1.forEach(p1 => {
        try {
            p1 = path.resolve(cachePath, p1);
            const stat = fs.statSync(p1);
            if (stat.isFile()) {
                del(p1, cachePath);
            }else if(stat.isDirectory()){
                let subfiles = fs.readdirSync(p1);
                const thumbnail = util.chooseThumbnailImage(subfiles);
                //only thumbnail
                for(let ii = 0; ii < subfiles.length; ii++){
                    const fileName = subfiles[ii];
                    const filePath = path.resolve(p1, fileName);

                    //compress first image to standard thumbnail
                    if(fileName === thumbnail){
                        if(minized && !util.isCompressedThumbnail(fileName) && util.canBeCompressed(fileName)){
                            const outputName = util.getCompressedThumbnailFileName(fileName);
                            const outputPath = path.resolve(p1, outputName);
                            const THUMB_WIDTH = 250; 
                            sharp(filePath)
                            .resize(250)
                            .toFile(outputPath, (err, info) => { 
                                if(!err){
                                    // console.log("[cleanCache] generate ", outputName);
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
}

module.exports.cleanCache = cleanCache;