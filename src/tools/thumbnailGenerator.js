const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('execa');

async function thumbnailGenerator(thumbnailFolderPath, imgFolder, fileName, callback){
    try{
        if(util.canBeCompressed(fileName)){
            const outputName = path.basename(imgFolder);
            const outputPath = path.resolve(thumbnailFolderPath, outputName)+".jpg";
            const filePath = path.resolve(imgFolder, fileName);

            const opt = [filePath, "-strip", "-quality", 70, "-resize", `280x280\>`, outputPath ]
    
            let {stdout, stderr} = await execa("magick", opt);
            return {stdout, stderr};
        }
    } catch(e) {
        console.error("[thumbnailGenerator] exception", e);
        callback && callback(e, info);
    }
}

module.exports = thumbnailGenerator;