filePath是primary key，也直接声明了create index
```js
const getFileToInfoAsync = async (filePath) => {
    const sql = ` SELECT * FROM file_table WHERE filePath = ?`;
    return await sqldb.getSync(sql, [filePath]);
}
```
[getImgFolderInfo] 4564 1518ms
[getImgFolderInfo] 4564 1716ms
[getImgFolderInfo] 4564 1793ms


```js
const getFileToInfoAsync = async (filePath) => {
    // const sql = ;
    // return await sqldb.getSync(sql, [filePath]);
    if(!stmd_single_file){
        stmd_single_file =  sqldb.prepare(` SELECT * FROM file_table WHERE filePath = ?`)
        stmd_single_file.getSync = _util.promisify(stmd_single_file.get).bind(stmd_single_file);
    }
    return stmd_single_file.getSync(filePath)
}
```
[getImgFolderInfo] 4564 818ms
[getImgFolderInfo] 4564 995ms
[getImgFolderInfo] 4564 710ms





```js
const getFileToInfo = function (filePath) {
    return fileToInfo[filePath];
}
```
[getImgFolderInfo] 4564 45ms
[getImgFolderInfo] 4564 75ms
[getImgFolderInfo] 4564 53ms



结论：
sql不擅长简单大次数的hash查询。
一种方法是用内存dict
另一种做法参考historyDb.js的getFileHistory(pathes) 