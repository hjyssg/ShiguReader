

const path = require('path');
const fs = require("fs");
const _ = require("underscore");
const execa = require('execa');
const isWindows = require('is-windows');

let hasEverythingCmdInstalled = false;

module.exports.init = async function(){
    if(isWindows()){
        try{
            //ask display help
            const {stdout, stderr} = await execa("es.exe -h");
            if(!stderr && stdout.length > 0){
                hasEverythingCmdInstalled = true;
            }
        } catch(e){
            console.log("[Recommendation] Install Everything Command-line Interface https://www.voidtools.com/downloads/");
        } 
    }
}

module.exports.isSupported = function(){
    return hasEverythingCmdInstalled;
}

async function searchSinglePath(path, config,  result){
    const reg =  config.types.map(e => e.replace(".", "")).join("|");

    try{
        //only files
        const {stdout, stderr} = await execa("es.exe", ["-csv", "-size",  "-dm", "/a-d", "-p", path, "-r", reg]);
        // const {stdout, stderr} = await execa("es.exe", ["-csv", "-size",  "-dm", "-p", path]);

        if(!stderr && stdout){
            const lines = stdout.split("\n");
            
            // 767919,05/19/2020 10:46,"D:\sdad\1.zip"
            lines.forEach(e =>{
                const tokens = e.split(",");
                const ds = tokens[1];
                const mtime = new Date(ds);
                const mtimeMs = mtime.getTime()
                
                if(!isNaN(mtimeMs)){
                    const index = e.indexOf(ds) + ds.length + 2;
                    const p = e.slice(index, e.length-2);
                    const stat = {};
                    stat.isFile = true;
                    stat.isDir = false;
                    stat.mtime = mtime;
                    stat.mtimeMs = mtimeMs;
                    stat.size = parseInt(tokens[0]);

                    if (config && config.filter && !config.filter(p, stat)) {
                        return;
                    }

                    if(config && config.doLog &&  result.pathes.length % 2000 === 0){
                        console.log("[everything-help] scan:", result.pathes.length);
                    }

                    result.infos[p] = stat;
                    result.pathes.push(p);
                }
            })
        }
    } catch(e){
        console.error("[everything-help] searchSinglePath", e);
    } 
}

module.exports.search = async function (folders, config) {
    const result = {pathes: [], infos: {}};
    for(let ii = 0; ii < folders.length; ii++){
        const src = folders[ii];
        if(fs.existsSync(src)){
            const stat = fs.statSync(src);
            if (stat.isFile()) {
                throw "only source folder path";
            } else {
                await searchSinglePath(src, config, result);
            }
        }else{
            console.error(`[file-iterator] ${src} does not exist! Please check you path-config and user-config.js`);
            console.error(`[file-iterator] ${src} 不存在! 检查一下你的path-config和user-config.js`);
        }
    }

    result.pathes = _.uniq(result.pathes);
    return result;
};

