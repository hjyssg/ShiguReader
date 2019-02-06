const fs = require('fs');
const path = require('path');
const userConfig = require('./user-config');
const cache_folder_name = path.resolve(userConfig.cache_folder_name);

let counter = 0;

function isSubDirectory(parent, child) {
    return path.relative(child, parent).startsWith('..');
}

function del(file){
    if(isSubDirectory(cache_folder_name, file)){
        const stat = fs.statSync(file);
        if(stat.isFile()){
            fs.unlinkSync(file);
        } else {
          fs.rmdirSync(file);
        }

        counter++;
        if(counter % 20 === 0){
            console.log("delete:", counter);
        }
    } else {
        throw "try to delete non-cache file";
    }
}

const folders1 = fs.readdirSync(cache_folder_name);
folders1.forEach(p1 => {
    p1 = path.resolve(cache_folder_name, p1);
    const stat = fs.statSync(p1);
    if (stat.isFile()) {
        //nothing
    }else if(stat.isDirectory()){
        const subfiles = fs.readdirSync(p1);
        subfiles.sort((a, b) => a.firstname.localeCompare(b.firstname))
        if(subfiles.length > 3){
            for(let ii = 2; ii < subfiles.length; ii++){
                del(path.resolve(p1, subfiles[ii]));
            }
        } else if (subfiles.length === 0){
            del(p1);
        }
    }
})