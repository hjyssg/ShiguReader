const state = {
    cachePath: '',
    thumbnailFolderPath: '',
    scannedPaths: [],
};

function setPaths({ cachePath, thumbnailFolderPath }) {
    if (cachePath !== undefined) {
        state.cachePath = cachePath;
    }
    if (thumbnailFolderPath !== undefined) {
        state.thumbnailFolderPath = thumbnailFolderPath;
    }
}

function getCachePath() {
    return state.cachePath;
}

function getThumbnailFolderPath() {
    return state.thumbnailFolderPath;
}

function setScannedPaths(paths) {
    state.scannedPaths = Array.isArray(paths) ? paths : [];
}

function getScannedPaths() {
    return state.scannedPaths;
}

module.exports = {
    setPaths,
    getCachePath,
    getThumbnailFolderPath,
    setScannedPaths,
    getScannedPaths,
};
