const path = require('path');


let thumbnailDb = {};

function addNewThumbnail(filePath) {
    const key = path.basename(filePath, path.extname(filePath));
    thumbnailDb[key] = filePath;
}

function init(filePathes) {
    filePathes.forEach(e => {
        addNewThumbnail(e);
    })
}

function getThumbnailFromThumbnailFolder(outputPath) {
    const key = path.basename(outputPath);
    return thumbnailDb[key];
}

function getThumbCount() {
    return _.keys(thumbnailDb).length;
}

module.exports = {
    addNewThumbnail,
    init,
    getThumbnailFromThumbnailFolder,
    getThumbCount,
};