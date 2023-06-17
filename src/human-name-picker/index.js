const config = require("./jp-family-name");
let family_names = config.family_names;
const family_name_regex = new RegExp(family_names.join("|"));

let name_entris = [];
let name_regex;

module.exports.init = () => {
    const path = require("path");
    readSingleFile(path.resolve(__dirname, 'av_tag_list.csv'));
    readSingleFile(path.resolve(__dirname, 'cos_tag_list.csv'));
    name_regex = new RegExp(name_entris.join("|"));
}

const readSingleFile = (filePath) => {
    const fs = require('fs');
    const Papa = require('papaparse');

    // 读取本地 CSV 文件
    // TODO: pkg打包会麻烦
    const csvData = fs.readFileSync(filePath, 'utf8');

    // 使用 papaparse 解析 CSV 数据
    const { data } = Papa.parse(csvData, { header: true, skipEmptyLines: true });

    // 将结果保存为 object array
    const objectArray = data.map(item => ({
        tag: item.tag,
        category: item.category,
    })).filter(e => e.tag);

    // console.log(objectArray);
    name_entris.push(...objectArray.map(e => e.tag));
}


const localCache = {};
function pick(str) {
    if (!str || localCache[str] === "NO_EXIST") {
        return null;
    }

    if (localCache[str]) {
        return localCache[str];
    }

    let result = [];
    //split by space english letter, digital number and punctuation
    //I dont use NLP library, because 
    //1.their size is too big
    //2. they cut a fullname into last name and meaningless substr
    const sep = /[ \dA-Za-z.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋]/;
    let tokens = splitBySpace(str, sep);
    tokens.forEach(tt => {
        const nameEntry = tt.match(name_regex);
        // const nameEntry = getContainSubstring(name_entris, tt);
        if (nameEntry) {
            nameEntry.forEach(e => {
                result.push(e);
            })
        } else {
            let familyName = tt.match(family_name_regex);
            if (familyName && familyName.index === 0) {
                familyName.forEach(e => {
                    //check the substring 常见日文名至少4个字，少了不要
                    const firstName = tt.replace(familyName, "");
                    if (firstName.length < 4) {
                        result.push(tt);
                    }
                })
            }
        }
    })

    result = result.filter(e => e);

    if (result.length === 0) {
        localCache[str] = "NO_EXIST";
        result = null;
    } else {
        localCache[str] = result;
    }
    return result;
}

const splitBySpace = module.exports.splitBySpace = function (str, sep) {
    sep = sep || /[ \.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋]/;
    const res = str.split(sep).filter(e => !!e);
    return res;

}
module.exports.pick = pick;