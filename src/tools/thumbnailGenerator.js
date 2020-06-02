const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('execa');

const THUMB_WIDTH = 250; 
async function thumbnailGenerator(thumbnailFolderPath, imgFolder, fileName, callback){
    try{
        if(util.canBeCompressed(fileName)){
            const outputName = path.basename(imgFolder);
            const outputPath = path.resolve(thumbnailFolderPath, outputName)+".jpg";
            const filePath = path.resolve(imgFolder, fileName);

            const opt = [filePath, "-strip", "-quality", 70, "-resize", `250x250\>`, outputPath ]
    
            let {stdout, stderr} = await execa("magick", opt);
            return {stdout, stderr};
        }
    } catch(e) {
        console.error("[thumbnailGenerator] exception", e);
        callback && callback(e, info);
    }
}

module.exports = thumbnailGenerator;