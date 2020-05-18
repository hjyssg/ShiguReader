const path = require('path');
const userConfig = require('../user-config');
const util = require("../util");
const fs = require('fs');
const _ = require('underscore');

const isImage = util.isImage;
const isMusic = util.isMusic;
const cache_folder_name = userConfig.cache_folder_name;
const pfs = require('promise-fs');

const rootPath = path.join(__dirname, "..", "..");
const getRootPath = function(){
    return rootPath;
}

//for thumbnail url
const fullPathToUrl = function (img){
    const fullpath = path.resolve(img);
    return turnPathSepToWebSep("..\\"+ path.relative(rootPath, fullpath));
}

const turnPathSepToWebSep = function (fn) {
    return fn.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
}

//for zip inside image and music files
const generateContentUrl = function (pathes, outputPath) {
    const files = [];
    const dirs = [];
    const musicFiles = [];
    if(pathes){
        const base = path.basename(outputPath);
        for (let i = 0; i < pathes.length; i++) {
            const p = path.basename(pathes[i]);
            let temp = path.join(cache_folder_name, base, p);
            temp = turnPathSepToWebSep(temp);
            if (isImage(p)) {
                files.push(temp);
            }else if(isMusic(p)){
                musicFiles.push(temp);
            }
        }
    }
    return { files, dirs, musicFiles };
}

const isExist = async (path) => {
    try{
        const error = await pfs.access(path);
        return !error;
    }catch(e){
        return false;
    }
};

function isDirectParent(parent, filePath){
    const parentPath = path.resolve(filePath, "..");
    return parentPath === parent;
}

function isSub(parent, child) {
    if(child.length > parent.length && child.startsWith(parent)){
        let parentPath = path.resolve(child, "..");
        while(true){
            if(parentPath === parent){
                return true;
            }

            const newparentPath = path.resolve(parentPath, "..");
            if(newparentPath === parentPath){
                //go to the top
                return false;
            }
            parentPath = newparentPath;
        }
    }
    return false;
}

function getHomePath(imgConvertFolder){
    const path_config_path = path.join(getRootPath(), "src", "path-config");
    //read text file 
    let results = fs.readFileSync(path_config_path).toString().split('\n'); 
    results = results
                .map(e => e.trim().replace(/\n|\r/g, ""))
                .filter(pp =>{ return pp && pp.length > 0 && !pp.startsWith("#");});
    results.push(imgConvertFolder);
    results = _.uniq(results);
    if(results.length === 0){
        if(isWindows()){
            const getDownloadsFolder = require('downloads-folder');
            results.push(getDownloadsFolder());
        }else{
            //downloads-folder cause error on unix
            results.push(`${process.env.HOME}/Downloads`);
        }
    }
    return results;
}

module.exports = {
    fullPathToUrl,
    generateContentUrl,
    getRootPath,
    isExist,
    isDirectParent,
    isSub,
    getHomePath
};