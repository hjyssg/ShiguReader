

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
    try{
        //only files
        const {stdout, stderr} = await execa("es.exe", ["-csv", "-size",  "-dm", "/a-d", "-p", path])
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

                    result.infos[p] = stat;
                    result.pathes.push(p);
                }
            })
        }
    }
    catch(e){
        console.error("[searchSinglePath] searchSinglePath", e);
    } 
}

module.exports.search = async function (folders, config) {
    const result = {infos: {}, pathes: [] };

    await searchSinglePath(folders[0], config, result);

    return result;
};

