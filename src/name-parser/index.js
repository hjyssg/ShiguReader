const config = require("./name-parser-config");
const same_tags = config.same_tags;
const not_author_but_tag = config.not_author_but_tag;
const char_names = require("./character-names");
const convertTable = {};


const localCache = {};

const ALL_COMIC_TAGS = [];
const comiket_tags = [];
const comic_star_tags = [];
for(let index = 65; index < 100; index++){
    comiket_tags.push(`C${index}`);
    ALL_COMIC_TAGS.push(`C${index}`);
}

ALL_COMIC_TAGS.push("COMIC1");
for(let index = 2; index < 20; index++){
    comic_star_tags.push(`COMIC1☆${index}`)
    ALL_COMIC_TAGS.push(`COMIC1☆${index}`);
}

//for sort algo, not very accurate
function getDateFromTags(tags){
  if(!tags || tags.length === 0){
      return null;
  }

  const _tags =  tags.filter(e => ALL_COMIC_TAGS.includes(e));
  let tag = _tags && _tags[0];
  let result = null;
  let num;
  let year;
  let month;
  if(tag){
    if(comiket_tags.includes(tag)){
        tag = tag.replace("C", "");
        num = parseInt(tag);
        year = Math.floor(num /2) + 1971;
        const isSummer = num % 2 === 0;
        month = isSummer? 8 : 11;
        const day = isSummer? 10: 28;
        result = new Date(year, month, day);
    }else if(comic_star_tags.includes(tag)){
        tag = tag.replace("COMIC1☆", "");
        num = parseInt(tag);

        if(num <= 10){
            //once per year
            result = new Date(2006+num, 3, 30);
        }else{
            num = (num - 10)
            year = 2017 + Math.floor(num /2);
            month = num % 2 === 0? 10 : 4;
            result = new Date(year, month, 30);
        }
    }
  }

  return result;
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

function includesWithoutCase(list, str){
    if(!str){
        return false;
    }
    list = list.map(e => e.toLowerCase());
    str = str.toLowerCase();
    return list.includes(str);
}

function toLowerCase(list, str){
    return list.map(e => e.toLowerCase());
}

function parse(str) {
    if (!str || localCache[str] === "NO_EXIST") {
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
        localCache[str] = "NO_EXIST";
        return;
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

    if(includesWithoutCase(not_author_but_tag, author)){
        tags.push(author);
        author = null;
    }

    if(!author && !group){
        localCache[str] = "NO_EXIST";
        return;
    }

    let comiket = null;
    tags.forEach(e => {
        if(includesWithoutCase(ALL_COMIC_TAGS, e)){
            comiket = e;
        }
    })

    let type;
    _TYPES_.forEach(t => {
        if(includesWithoutCase(tags, t)){
            type = t;
        }
    });

    if(!type && (comiket|| group)){
        type = "Doujin";
    }
    type = type || "etc";

    let title = str;
    (bMacthes||[]).concat( pMacthes||[], tags||[], [/\[/g, /\]/g, /\(/g, /\)/g ]).forEach(e => {
        title = title.replace(e, "");
    })
    title = title.trim();

    const result = {
        author, tags, comiket, type, group, title
    };

    localCache[str] = result;
    return result;
}

module.exports.parse = parse;
module.exports.isOnlyDigit = isOnlyDigit;
module.exports.ALL_COMIC_TAGS = ALL_COMIC_TAGS;
module.exports.getDateFromTags = getDateFromTags;
