const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('../server/own_execa');

async function thumbnailGenerator(thumbnailFolderPath, imgFolder, fileName) {
    let outputFilePath = null;

    try {
        if (util.canBeCompressed(fileName)) {
            const outputName = path.basename(imgFolder);
            const outputPath = path.resolve(thumbnailFolderPath, outputName) + ".jpg";
            const inputFilePath = path.resolve(imgFolder, fileName);

            if (global._has_magick_) {
                const opt = [inputFilePath, "-strip", "-resize", `280x354\>`, outputPath];
                let { stdout, stderr } = await execa("magick", opt);
                if (stderr) {
                    throw stderr;
                }
                outputFilePath = outputPath
            }
            //  else {
            //    // sharp 不能通过pkg打包进去
            //     const sharp = require('sharp');
            //     await sharp(inputFilePath).resize(280, 354).toFile(outputPath);
            //     outputFilePath = outputPath;
            // }
        }
    } catch (e) {
        console.error("[thumbnailGenerator] exception", e);
    } finally {
        return outputFilePath;
    }
}

module.exports = thumbnailGenerator;