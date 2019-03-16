const fs = require('fs');
const path = require('path');
const userConfig = require('../user-config');
const rimraf = require("./rimraf");
const cache_folder_name = path.resolve(userConfig.cache_folder_name);
const util = require("../util");

let counter = 0;

function isSubDirectory(parent, child) {
    return path.relative(child, parent).startsWith('..');
}

function del(file){
    if(isSubDirectory(cache_folder_name, file)){
        rimraf(file, (err) =>{
            if(err){
                try{
                    const stat = fs.statSync(file);
                    if(stat.isFile()){
                        fs.unlinkSync(file);
                    } else {
                        fs.rmdirSync(file);
                    }
                }catch(e){
                    console.error(file, e);
                }
            }
        });

        counter++;
        if(counter % 20 === 0){
            console.log("delete:", counter);
        }
    } else {
        throw "try to delete non-cache file";
    }
}

function cleanCache(){
    const folders1 = fs.readdirSync(cache_folder_name);
    folders1.forEach(p1 => {
        p1 = path.resolve(cache_folder_name, p1);
        const stat = fs.statSync(p1);
        if (stat.isFile()) {
            //nothing
            del(p1);
        }else if(stat.isDirectory()){
            let subfiles = fs.readdirSync(p1);
            const noimages = subfiles.filter(e => !util.isImage(e));
            noimages.forEach(e => del(path.resolve(p1,e)));

            subfiles = subfiles.filter(e => util.isImage(e));
            util.sortFileNames(subfiles);
            if (subfiles.length === 0){
                del(p1);
            }else  if(subfiles.length === 1){
                //nothing
            }else if(subfiles.length >= 2){
                for(let ii = 1; ii < subfiles.length; ii++){
                    del(path.resolve(p1, subfiles[ii]));
                }
            }
        }
    });
    console.log("cache clean done");
}

module.exports.cleanCache = cleanCache;