const fs = require('fs');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const pLimit = require('p-limit');
const isWindows = require('is-windows');
const zipInfoDb = require("./models/zipInfoDb");
const { updateZipDb }  = zipInfoDb;
const logger = require("./models/logger").logger;
const util = require("../util");
const pathUtil = require("./pathUtil");
const { isImage, isCompress, isMusic, isVideo, arraySlice, getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;
const { generateContentUrl } = pathUtil;

let sevenZip;
if(isWindows()){
    const sevenZipPath = path.join(process.cwd(), "resource/7zip");
    sevenZip = require(sevenZipPath)['7z'];
    console.log("sevenZipPath", sevenZipPath);
}else{
    //assume linux/mac people already install it by cmd
    //https://superuser.com/questions/548349/how-can-i-install-7zip-so-i-can-run-it-from-terminal-on-os-x
    sevenZip = "7z";
}

module.exports.sevenZip = sevenZip;


function read7zOutput(data) {
    const lines = data && data.split("\n");
    const files = [];
    for (let ii = 0; ii < lines.length; ii++) {
        let line = lines[ii].trim();
        let tokens = line.split(" = ");
        // an example 
        // Path = 041.jpg
        // Folder = -
        // Size = 1917111
        // Packed Size = 1865172
        // Modified = 2020-04-03 17:29:52
        // Created = 2020-04-03 17:29:52
        // Accessed = 2020-04-03 17:29:52
        if(tokens.length === 2){
            const key = tokens[0];
            const value = tokens[1].trim();
            if(key.toLowerCase() === "path"){
                files.push(value);
            }
        }
    }
    return files;
}

const get7zipOption = module.exports.get7zipOption = function(filePath, outputPath, file_specifier){
    //https://sevenzip.osdn.jp/chm/cmdline/commands/extract.htm
    //e make folder as one level
    if(file_specifier){
        let specifier =  _.isArray(file_specifier)? file_specifier : [file_specifier];
        specifier = specifier.map(e => {
            //-0018.jpg will break 7zip
            if(e.startsWith("-")){
                return "*" + e.slice(1);
            }else{
                return e;
            }
        })

        return ['e', filePath, `-o${outputPath}`].concat(specifier, "-aos");
    }else{
        return ['e', filePath, `-o${outputPath}`, "-aos"];
    }
}

const limit = pLimit(1);
module.exports.listZipContent = async function (filePath){
    try{
        //https://superuser.com/questions/1020232/list-zip-files-contents-using-7zip-command-line-with-non-verbose-machine-friend
        let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-r', '-ba' ,'-slt', filePath]));
        const text = stdout;
        if (!text || stderr) {
            return [];
        }

        const files = read7zOutput(text);
        const imgFiles = files.filter(isImage);
        const musicFiles = files.filter(isMusic)

        updateZipDb(filePath, imgFiles.length, musicFiles.length);
        return files;
    }catch(e){
        logger.error("[listZipContent]", filePath, e);
        console.error("[listZipContent]", filePath, e);
        return [];
    }
}

module.exports.extractByRange = async function(filePath, outputPath, range){
    let error;
    try{
        //quitely unzip second part
        const DISTANCE = 200;
        let ii = 0;

        while(ii < range.length){
            //cut into parts
            //when range is too large, will cause OS level error
            let subRange = range.slice(ii, ii+DISTANCE);
            let opt = get7zipOption(filePath, outputPath, subRange);
            let { stderr } = await execa(sevenZip, opt);
            if(stderr){
                error = stderr;
                console.error('[extractByRange] exit: ', stderr);  
                logger.error('[extractByRange] exit: ', stderr);
                break;
            }
            ii = ii+DISTANCE;
        }
    }catch (e){
        error = e;
        console.error('[extractByRange] exit: ', e);
        logger.error('[extractByRange] exit: ', e);
    }finally{
        return error;
    }
}
module.exports.extractAll = async function(filePath, outputPath, sendBack, res, stat){
    const opt = get7zipOption(filePath, outputPath);
    const { stderr } = await execa(sevenZip, opt);
    if (!stderr) {
        sendBack && fs.readdir(outputPath, (error, pathes) => {
            const temp = generateContentUrl(pathes, outputPath);
            sendBack(temp.files, temp.musicFiles, filePath, stat);
        });
    } else {
        res && res.sendStatus(500);
        console.error('[extractAll] exit: ', stderr);
    }
}