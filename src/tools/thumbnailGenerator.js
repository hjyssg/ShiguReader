const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('execa');

async function thumbnailGenerator(thumbnailFolderPath, imgFolder, fileName) {
    let outputFilePath = null;

    try {
        if (util.canBeCompressed(fileName)) {
            const outputName = path.basename(imgFolder);
            const outputPath = path.resolve(thumbnailFolderPath, outputName) + ".jpg";
            const filePath = path.resolve(imgFolder, fileName);

            if(global._has_magick_){
                const opt = [filePath, "-strip", "-resize", `280x354\>`, outputPath];
                let { stdout, stderr } = await execa("magick", opt);
                if (stderr) {
                    throw stderr;
                }
                outputFilePath = outputPath
            }else{
                const sharp = require('sharp');
                const THUMB_WIDTH = 250; 
                let toFile = sharp(filePath).resize(280, 354).toFile;
                const _util = require('util');
                const toFileAsync = _util.promisify(toFile);
                await toFileAsync(outputPath);
                outputFilePath = outputPath;
            }
        }
    } catch (e) {
        console.error("[thumbnailGenerator] exception", e.stderr);
    } finally {
        return outputFilePath;
    }
}

module.exports = thumbnailGenerator;