const path = require('path');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
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

function isSub(parent, child, pTokens) {
    if(child.length > parent.length && child.startsWith(parent)){
        pTokens = pTokens || parent.split(path.sep);
        const cTokens = child.split(path.sep);
        
        // return pTokens.every((e, index) => {
        //     return e === cTokens[index];
        // })

        //because we already use startsWith
        //we do not need to compare every piece
        //we only compare one piece
        const index = pTokens.length-1;  
        //its direct parent's name
        return cTokens[index] === pTokens[index];

    }
    return false;
}

function getHomePath(){
    const path_config_path = path.join(getRootPath(), "src", "path-config");
    //read text file 
    let home_pathes = fs.readFileSync(path_config_path).toString().split('\n'); 
    home_pathes = home_pathes
                .map(e => e.trim().replace(/\n|\r/g, ""))
                .filter(pp =>{ return pp && pp.length > 0 && !pp.startsWith("#");});

    //add one more
    home_pathes.push(getImgConverterCachePath());
    home_pathes = _.uniq(home_pathes);

    //does not show 
    if(home_pathes.length === 1){
        if(isWindows()){
            const getDownloadsFolder = require('downloads-folder');
            home_pathes.push(getDownloadsFolder());
        }else{
            //downloads-folder cause error on unix
            home_pathes.push(`${process.env.HOME}/Downloads`);
        }
    }

    path_will_scan = home_pathes.concat(userConfig.good_folder, userConfig.good_folder_root, userConfig.not_good_folder)
    return {
        home_pathes,
        path_will_scan
    };
}

function getImgConverterCachePath(){
    const imgConvertFolder = path.join(getRootPath(), userConfig.workspace_name,  userConfig.img_convert_cache);
    return imgConvertFolder;
}

module.exports = {
    fullPathToUrl,
    generateContentUrl,
    getRootPath,
    isExist,
    isDirectParent,
    isSub,
    getHomePath,
    getImgConverterCachePath
};