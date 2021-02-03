
const path = require('path');
const _ = require('underscore');

//everthing是根据filename去match的，所以找不了img folder
function parseResult(json, config) {
    const result = {};
    result.fileInfos = {};
    result.dirResults = [];

    json.results.forEach(e => {
        const fp = path.resolve(e.path, e.name);

        if (config.filter && !config.filter(fp, e)) {
            return false;
        }

        if (e.type === "folder") {
            result.dirResults.push(fp)
            return false;
        }

        if (e.type === "file") {
            // https://www.voidtools.com/forum/viewtopic.php?t=5427
            //The 18-digit Active Directory timestamps, also named 'Windows NT time format', 'Win32 FILETIME or SYSTEMTIME' or NTFS file time. These are used in Microsoft Active Directory for pwdLastSet, accountExpires, LastLogon, LastLogonTimestamp, and LastPwdSet. The timestamp is the number of 100-nanosecond intervals (1 nanosecond = one billionth of a second) since Jan 1, 1601 UTC.
            const ldap = parseInt(e.date_modified);
            //http://balrob.blogspot.com/2014/04/windows-filetime-to-javascript-date.html
            let sec = Math.floor(ldap / 10000000);
            sec -= 11644473600;
            let datum = new Date(sec * 1000);
            let mtime = datum.getTime();

            const stat = {
                isFile: e.type === "file",
                isDir: e.type === "folder",
                mtimeMs: mtime,
                mtime,
                size: parseInt(e.size)
            }
            result.fileInfos[fp] = stat;
        }
    });

    return result;
}

module.exports.searchByText = async function (text, config) {
    try {
        const port = config.port;
        const tt = encodeURIComponent(text);
        const uri = `http://localhost:${port}/?search="${tt}"&offset=0&json=1&path_column=1&size_column=1&date_modified_column=1`;

        const rp = require('request-promise');
        const json = await rp({
            uri,
            json: true
        });
        return parseResult(json, config);
    } catch (e) {
        console.error(e);
        return null;
    }
}

// // https://www.voidtools.com/forum/viewtopic.php?f=2&t=8703&p=29464&hilit=http+path#p29464
// module.exports.getAllFileinPath = async function (fpArr, config) {
//     try {
//         const rp = require('request-promise');

//         const result = {};
//         result.infos = {};
//         result.pathes = [];

//         const port = config.port;

//         for (let ii = 0; ii < fpArr.length; ii++) {
//             const fp = encodeURIComponent(fpArr[ii]);
//             const uri = `http://localhost:${port}/?search="${fp}"&offset=0&json=1&path_column=1&size_column=1&date_modified_column=1`;

//             console.log("begin searching", uri);
//             const json = await rp({
//                 uri,
//                 json: true
//             });


//             // _.uniq is super slow for big arr
//         }

//         console.log("[everything_connector] all done");
//         if (result.pathes.length === 0) {
//             return null;
//         }

//         return result;
//     } catch (e) {
//         return null;
//     }
// }