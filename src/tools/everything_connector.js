// https://www.voidtools.com/forum/viewtopic.php?f=2&t=8703&p=29464&hilit=http+path#p29464
//  npm install request request-promise

const path = require('path');
var rp = require('request-promise');
const _ = require('underscore');


module.exports.getAllFileinPath = async function (fpArr, config){
    try{
        const result = {};
        result.infos = {};
        result.pathes = [];

        const port = config.port;
    
        for(let ii = 0; ii < fpArr.length; ii ++) {
            const fp = encodeURIComponent(fpArr[ii]);
            const uri = `http://localhost:${port}/?search="${fp}"&offset=0&json=1&path_column=1&size_column=1&date_modified_column=1`;

            console.log("begin searching", uri);
            const json = await rp({
                uri,
                json: true
            });

            json.results = json.results.filter(e => {
                if(e.type === "folder" || (!e.name.includes(".")) ){
                    return false;
                }

                if (config.filter && !config.filter(e.name)) {
                    return false;
                }

                const p = path.resolve(e.path, e.name);
                if(result.infos[p]){
                    return false;
                }
                return e.type === "file";
            });

            // console.log("searched", json.totalResults);
            const len = json.results.length;
            console.log("searched",  len)

            json.results.forEach((e, ii) => {
                // "type":"file",
                // "name":"45.png",
                // "path":"C:\\Users\\jhuang342\\Downloads\\1111",
                // "size":"106061",
                // "date_modified":"132495376090893199"
                const p = path.resolve(e.path, e.name);
                const mtime = parseInt(e.date_modified) / 82550;  //not idea why the mtime from everything is wrong
                const stat = {
                    isFile: e.type === "file",
                    isDir: e.type === "folder",
                    mtimeMs: mtime,
                    mtime: mtime,
                    size: parseInt(e.size)
                }
    
                result.infos[p] = stat;
                result.pathes.push(p);

                const currentLen = ii;

                if(config && config.doLog &&  currentLen % 1000 === 0){
                    // console.log(p)
                    console.log("[everything_connector] scan:", currentLen, `  ${(currentLen/len*100).toFixed(2)}%`);
                }
            })

            // _.uniq is super slow for big arr
            // result.pathes = _.uniq(result.pathes);
        }

        console.log("[everything_connector] all done");
        if(result.pathes.length === 0){
            return null;
        }

        return result;
    }catch(e){
        return null;
    }
}