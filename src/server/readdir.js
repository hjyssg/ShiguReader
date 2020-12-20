

const path = require('path');
const _ = require("underscore");
const pfs = require('promise-fs');
const junk = require('junk');

const isHiddenFile = function (f) {
    const temp = path.basename(f);
    return temp && temp[0] === ".";
}

const forbid = ["System Volume Information", "\\\$Recycle.Bin"];
const regex = new RegExp(forbid.join("|"), "i");

module.exports = async function(fp, option){
    let pathes = await pfs.readdir(fp, option);
    pathes = pathes.filter(e => {
        if(option && option.withFileTypes){
            e = e.name;
        }
        return !isHiddenFile(e) && !e.match(regex) && junk.not(e);
    }); 
    return pathes;
}

