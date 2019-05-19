const config = require("./name-parser-config");
const same_tags = config.same_tags;
const not_author_but_tag = config.not_author_but_tag;
const char_names = require("./character-names");
const convertTable = {};

const localCache = {};

const comiketTags = [];
for(let index = 65; index < 97; index++){
    comiketTags.push(`C${index}`);
}

comiketTags.push("COMIC1");
for(let index = 2; index < 16; index++){
    comiketTags.push(`COMIC1☆${index}`);
}

same_tags.forEach(row => {
    for(let ii = 1; ii < row.length; ii++){
        convertTable[row[ii]] = row[0];
    }
});

char_names.sort((a, b) => (b.length - a.length))

let pReg = /\((.*?)\)/g  
let bReg = /\[(.*?)\]/g ;

function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}

function isDate(str) {
    if (str && str.length === 6) {
        const y = parseInt(str.slice(0, 2));
        const m = parseInt(str.slice(2, 4));
        const d = parseInt(str.slice(4, 6));

        let invalid = y > 30 && y < 80;
        invalid = invalid || (m < 0 || m > 12);
        invalid = invalid || (d < 0 || d > 30);
        return !invalid;
    }
    return false;
}

function convertYearString(str) {
    let y =  parseInt(str.slice(0, 2));
    const m = str.slice(2, 4);

    if (y > 80) {
        y = 1900 + y;
    }else {
        y = 2000 + y;
    }

    return y + "/" + m;
}

function getAuthorName(str){
    var macthes = str.match(/(.*?)\s*\((.*?)\)/);
    if(macthes && macthes.length > 0){
        return {
            group: macthes[1].trim(),
            name: macthes[2].trim(),
        };
    }else{
        return {
            name: str.trim(),
        };
    }
}

function match(reg, str){
    const result = [];
    var token = reg.exec(str);
    while (token){
        result.push(token[1]);
        token = reg.exec(str);
    }
    return result;
}

const NEED_GROUP = false;

const _TYPES_ = [
    "同人音声",
    "成年コミック",
    "一般コミック",
    "同人CG集",
    "ゲームCG",
    "画集"
]

function parse(str) {
    if (!str) {
      return null;
    }

    if(localCache[str]){
        return localCache[str];
    }

    const bMacthes =  match(bReg, str);
    const pMacthes = match(pReg, str);

    const hasB = (bMacthes && bMacthes.length > 0);
    const hasP = (pMacthes && pMacthes.length > 0);

    if(!hasB && !hasP){
        return null;
    }

    let tags = [];
    let author = null;
    let group = null;

    // looking for author, avoid 6 year digit
    if (bMacthes && bMacthes.length > 0) {
        for (let ii = 0; ii < bMacthes.length; ii++) {
            let token = bMacthes[ii].trim();
            if(isOnlyDigit(token)){
                if (isDate(token)) {
                    token = convertYearString(token);
                    tags.push(token);
                }
            } else {
                //  [真珠貝(武田弘光)]
                const temp = getAuthorName(token);
                author = temp.name;
                // NEED_GROUP && temp.group && tags.push(temp.group);
                group = temp.group;
                break;
            }
        }
    }

    if (pMacthes && pMacthes.length > 0) {
        tags = tags.concat(pMacthes);
        tags = tags.filter(e=> {return !isOnlyDigit(e)});
    }

    if(tags.indexOf(author) >= 0){
        tags.splice(tags.indexOf(author), 1);
    }

    char_names.forEach(name => {
        if(str.indexOf(name) > -1 && (author||"").indexOf(name) === -1 ){
            tags.push(name);
        }
    })

    tags = tags.map(e => {
        if(convertTable[e]){
            return convertTable[e];
        }
        return e;
    })

    if(not_author_but_tag.includes(author)){
        tags.push(author);
        author = null;
    }

    let comiket = null;
    tags.forEach(e => {
        if(comiketTags.includes(e)){
            comiket = e;
        }
    })

    let type;
    _TYPES_.forEach(t => {
        if(tags.includes(t)){
            type = t;
        }
    });


    if(!type && (comiket|| group)){
        type = "Doujin";
    }
    type = type || "etc";

    const result = {
        author, tags, comiket, type, group
    };

    localCache[str] = result;
    return result;
}

module.exports.parse = parse;
module.exports.isOnlyDigit = isOnlyDigit;
module.exports.comiketTags = comiketTags;
