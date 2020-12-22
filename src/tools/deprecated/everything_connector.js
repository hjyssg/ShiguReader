
const path = require('path');
const _ = require('underscore');


// https://www.voidtools.com/forum/viewtopic.php?f=2&t=8703&p=29464&hilit=http+path#p29464
module.exports.getAllFileinPath = async function (fpArr, config) {
    try {
        const rp = require('request-promise');

        const result = {};
        result.infos = {};
        result.pathes = [];

        const port = config.port;

        for (let ii = 0; ii < fpArr.length; ii++) {
            const fp = encodeURIComponent(fpArr[ii]);
            const uri = `http://localhost:${port}/?search="${fp}"&offset=0&json=1&path_column=1&size_column=1&date_modified_column=1`;

            console.log("begin searching", uri);
            const json = await rp({
                uri,
                json: true
            });

            json.results = json.results.filter(e => {
                if (e.type === "folder" || (!e.name.includes("."))) {
                    return false;
                }

                if (config.filter && !config.filter(e.name)) {
                    return false;
                }

                const p = path.resolve(e.path, e.name);
                if (result.infos[p]) {
                    return false;
                }
                return e.type === "file";
            });

            // console.log("searched", json.totalResults);
            const len = json.results.length;
            console.log("searched", len)

            for (let jj = 0; jj < json.results.length; jj++) {
                const e = json.results[jj];
                const p = path.resolve(e.path, e.name);

                // https://www.voidtools.com/forum/viewtopic.php?t=5427
                //The 18-digit Active Directory timestamps, also named 'Windows NT time format', 'Win32 FILETIME or SYSTEMTIME' or NTFS file time. These are used in Microsoft Active Directory for pwdLastSet, accountExpires, LastLogon, LastLogonTimestamp, and LastPwdSet. The timestamp is the number of 100-nanosecond intervals (1 nanosecond = one billionth of a second) since Jan 1, 1601 UTC.
                const ldap = parseInt(e.date_modified);
                //http://balrob.blogspot.com/2014/04/windows-filetime-to-javascript-date.html
                var sec = Math.floor(ldap / 10000000);
                sec -= 11644473600;
                var datum = new Date(sec * 1000);
                let mtime = datum.getTime();;

                const stat = {
                    isFile: e.type === "file",
                    isDir: e.type === "folder",
                    mtimeMs: mtime,
                    mtime: mtime,
                    size: parseInt(e.size)
                }

                result.infos[p] = stat;
                result.pathes.push(p);

                const currentLen = jj;

                if (config && config.doLog && currentLen % 2000 === 0) {
                    // console.log(p)
                    console.log("[everything_connector] scan:", currentLen, `  ${(currentLen / len * 100).toFixed(2)}%`);
                }
            }
            // _.uniq is super slow for big arr
        }

        console.log("[everything_connector] all done");
        if (result.pathes.length === 0) {
            return null;
        }

        return result;
    } catch (e) {
        return null;
    }
}