

const path = require('path');
const _ = require("underscore");
const pfs = require('promise-fs');
const junk = require('junk');

const isHiddenFile = function (f) {
    const temp = path.basename(f);
    return temp && temp[0] === ".";
}


const forbid = ["System Volume Information", "$Recycle.Bin", "Config.Msi", "$WinREAgent", "Windows"];
function isForbid(str){
    str = str.toLocaleLowerCase();
    return forbid.some(e => {
        return  path.basename(str) === e.toLocaleLowerCase();
    });
}

module.exports = async function(fp, option){
    let pathes = await pfs.readdir(fp, option);
    pathes = pathes.filter(e => {
        if(option && option.withFileTypes){
            e = e.name;
        }
        return !isHiddenFile(e) && !isForbid(e) && junk.not(e);
    }); 
    return pathes;
}

