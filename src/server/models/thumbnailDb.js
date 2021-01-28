const path = require('path');
const _ = require('underscore');
const serverUtil = require("../serverUtil");
const { getHash } = serverUtil;


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

function get(filePath) {
    const key = getHash(filePath);
    return thumbnailDb[key];
}

function getThumbCount() {
    return _.keys(thumbnailDb).length;
}

module.exports = {
    addNewThumbnail,
    init,
    get,
    getThumbCount,
};