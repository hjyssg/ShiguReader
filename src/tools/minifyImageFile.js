const fs = require('fs');
const path = require('path');
const util = require("../util");
const sharp = require('sharp');

function minifyImageFile(p1, fileName, callback){
    try{
        if(!util.isCompressedThumbnail(fileName) && util.canBeCompressed(fileName)){
            const outputName = util.getCompressedThumbnailFileName(fileName);
            const outputPath = path.resolve(p1, outputName);
            const THUMB_WIDTH = 250; 
            const filePath = path.resolve(p1, fileName);

            sharp(filePath)
            .resize(THUMB_WIDTH)
            .toFile(outputPath, (err, info) => { 
                callback && callback(err, info);
            });
            }
    } catch(e) {
        console.error("[minifyImageFile] exception", e);
        handleFail();
    }
}

module.exports.minifyImageFile = minifyImageFile;