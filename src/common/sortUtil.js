const nameParser = require('../name-parser');
const _ = require('underscore');

module.exports.sort_file_by_time = function (files, config) {
    const { fileInfos, getBaseName, fromEarly, onlyMtime, fileNameToReadTime } = config;
    return _.sortBy(files, a => {
        const fn = getBaseName(a);
        let fileTimeA;

        if(fileNameToReadTime[fn]){
            fileTimeA = parseInt(fileNameToReadTime[fn]);
        }else{
            fileTimeA = (fileInfos[a] && fileInfos[a].mtimeMs) || -Infinity;
        }
        // console.log(fn, fileTimeA)
        if (onlyMtime) {
            return fromEarly ? fileTimeA : -fileTimeA;
        } else {
            let aboutTimeA = nameParser.getDateFromParse(fn);
            aboutTimeA = aboutTimeA && aboutTimeA.getTime();
            const t1 = aboutTimeA || fileTimeA;
            return fromEarly ? t1 : -t1;
        }
    })
}

