const fs = require('fs');
const path = require('path');
const util = global.requireUtil();

const THUMB_WIDTH = 250; 
function thumbnailGenerator(thumbnailFolderPath, imgFolder, fileName, callback){
    try{
        //sharp is difficult to install, because GFW
        //but the server runs without it anyway
        const sharp = require('sharp');
        if(sharp && !util.isCompressedThumbnail(fileName) && util.canBeCompressed(fileName)){
            const outputName = path.basename(imgFolder);
            const outputPath = path.resolve(thumbnailFolderPath, outputName)+".jpg";
            const filePath = path.resolve(imgFolder, fileName);

            sharp(filePath)
            .resize(THUMB_WIDTH)
            .toFile(outputPath, (err, info) => { 
                callback && callback(err, info);
            });
            }
    } catch(e) {
        console.error("[thumbnailGenerator] exception", e);
        callback && callback(err, info);
    }
}

module.exports = thumbnailGenerator;