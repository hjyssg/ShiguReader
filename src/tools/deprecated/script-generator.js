

const path = require('path');
const fs = require("fs");


function getStat(p, config){
    const stat = fs.statSync(p);
    stat.isFile = stat.isFile();
    stat.isDirectory = stat.isDirectory();
    return stat;
}

function iterate (p, config, result, depth) {
    console.log(`cd ${p}`)
    console.log("              ");
    fs.readdirSync(p).forEach((e, ii) => {
        const stat = getStat(p, config);
        const fp = path.join(p, e);
        if(stat.isDirectory()){
            console.log("7z.exe a", `"${e}.zip"  "${fp}\\*" `, )
        }
        if(ii%5 === 0){
            console.log("              ");
        }
    });
}

iterate("D:\\2");
