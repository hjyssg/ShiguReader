const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('execa');

async function thumbnailGenerator(thumbnailFolderPath, imgFolder, fileName){
    let outputFilePath = null;
    try{
        if(util.canBeCompressed(fileName) && global._has_magick_){
            const outputName = path.basename(imgFolder);
            const outputPath = path.resolve(thumbnailFolderPath, outputName)+".jpg";
            const filePath = path.resolve(imgFolder, fileName);
            const opt = [filePath, "-strip", "-resize", `280x354\>`, outputPath ];
            let {stdout, stderr} = await execa("magick", opt);
            if(!stderr){
                outputFilePath = outputPath;
            }
        }
    } catch(e) {
        console.error("[thumbnailGenerator] exception", e.stderr);
    }finally{
        return outputFilePath;
    }
}

module.exports = thumbnailGenerator;