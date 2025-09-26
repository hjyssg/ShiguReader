const fs = require('fs');
const path = require('path');
const pathUtil = require('../utils/path-util');
const userConfig = require('../config/user-config');

function ensureDirSync(dirPath) {
    if (dirPath && !fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function initializeEnvironment() {
    pathUtil.init();
    const rootPath = pathUtil.getRootPath();

    const { cache_folder_name, thumbnail_folder_name } = userConfig;
    const cachePath = path.join(rootPath, cache_folder_name);
    const thumbnailFolderPath = path.join(rootPath, thumbnail_folder_name);
    const workspacePath = pathUtil.getWorkSpacePath();

    [workspacePath, thumbnailFolderPath, cachePath, pathUtil.getImgConverterCachePath()].forEach(ensureDirSync);

    const distPath = path.resolve(rootPath, 'dist');

    return {
        rootPath,
        cachePath,
        thumbnailFolderPath,
        workspacePath,
        distPath,
        indexHtmlPath: path.resolve(distPath, 'index.html'),
        bundleJsPath: path.resolve(distPath, 'bundle.js'),
        etcConfigPath: path.resolve(rootPath, 'config-etc.ini'),
        pathConfigPath: path.join(rootPath, 'config-path.ini'),
    };
}

module.exports = initializeEnvironment;
