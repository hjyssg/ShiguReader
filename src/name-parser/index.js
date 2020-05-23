const config = require("./name-parser-config");
const same_tags = config.same_tags;
const not_author_but_tag = config.not_author_but_tag;
let char_names = require("./character-names");

const book_types = [
    "同人音声",
    "同人ソフト",
    "同人CG集",
    "同人ゲーム",
    "成年コミック",
    "一般コミック",
    "ゲームCG",
    "画集"
]

const localCache = {};

function init(){
    let comiket_tags = [];
    let comic_star_tags = [];
    for(let index = 65; index < 100; index++){
        comiket_tags.push(`C${index}`);
    }
    
    comic_star_tags.push("COMIC1");
    for(let index = 2; index < 20; index++){
        comic_star_tags.push(`COMIC1☆${index}`)
    }

    let all_comic_tags = comiket_tags.concat(comic_star_tags);

    const all_comic_tags_table = {}
    all_comic_tags.forEach(e => {
        all_comic_tags_table[e.toLowerCase()] = true;
    });

    const book_type_table = {};
    book_types.forEach(e => {
        book_type_table[e.toLowerCase()] = true;
    })

    const not_author_but_tag_table = {};
    not_author_but_tag.forEach(e => {
        not_author_but_tag_table[e.toLowerCase()] = true;
    })


    //--------------------------------------------
    const convert_table = {};
    same_tags.forEach(row => {
        for(let ii = 1; ii < row.length; ii++){
            convert_table[row[ii]] = row[0];
        }
    });


    //------------------------------------
    return {
        all_comic_tags,
        all_comic_tags_table,
        book_type_table,
        not_author_but_tag_table,
        comiket_tags,
        comic_star_tags,
        convert_table
    }
}

const {
    all_comic_tags,
    all_comic_tags_table,
    not_author_but_tag_table,
    book_type_table,
    comiket_tags,
    comic_star_tags,
    convert_table
} = init();


const tag_to_date_table = {};
function getDateFromParse(str){
    const pp = parse(str);
    let result;
    if(pp){
        if(pp.dateTag){
            result = getDateFromStr(pp.dateTag);
        }else{
            result = getDateFromTags(pp.tags)
        }
    }
    return result;
}

//for sort algo, not very accurate
function getDateFromTags(tags){
  if(!tags || tags.length === 0){
      return null;
  }

  const _tags =  tags.filter(e => all_comic_tags.includes(e));
  let tag = _tags && _tags[0];
  let result = null;
  let num;
  let year;
  let month;
  if(tag){
    if (tag_to_date_table[tag]) {
        result = tag_to_date_table[tag];
    } else if(comiket_tags.includes(tag)) {
        tag = tag.replace("C", "");
        num = parseInt(tag);
        year = Math.floor(num /2) + 1971;
        const isSummer = num % 2 === 0;
        month = isSummer? 8 : 11;
        const day = isSummer? 10: 28;
        result = new Date(year, month, day);
        tag_to_date_table[tag] = result;
    } else if(comic_star_tags.includes(tag)) {
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
        tag_to_date_table[tag] = result;
    }
  }

  return result;
}


let pReg = /\((.*?)\)/g;
let bReg = /\[(.*?)\]/g;

function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}

function getDateFromStr(str){
    let y = convertYearString(str);
    let m = parseInt(str.slice(2, 4));
    let d = parseInt(str.slice(4, 6));

    m = m - 1;
    return new Date(y, m, d);
}

function convertYearString(str) {
    let y =  parseInt(str.slice(0, 2));

    if (y > 80) {
        y = 1900 + y;
    }else {
        y = 2000 + y;
    }

    return y;
}

function isStrDate(str) {
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



function getTypeAndComiket(tags, group){
    let comiket;
    let type;
    tags.forEach(e => {
        e = e.toLowerCase();
        if(all_comic_tags_table[e]){
            comiket = e;
        }else if(book_type_table[e]){
            type = e;
        }
    })

    if(!type){
        if(comiket|| group){
            type = "Doujin";
        }else{
            type = "etc";
        }
    }

    return {
        comiket, type
    }
}

function getTag(str, pMacthes, author){
    let tags = [];
    if (pMacthes && pMacthes.length > 0) {
        tags = tags.concat(pMacthes);
        tags = tags.filter(e=> {return !isOnlyDigit(e)});
    }

    if(author && tags.indexOf(author) >= 0){
        tags.splice(tags.indexOf(author), 1);
    }

    char_names.forEach(name => {
        if(str.includes(name)){
            tags.push(name);
        }
    })

    tags = tags.map(e => {
        return convert_table[e] || e;
    })

    return tags;
}

function parse(str) {
    if (!str || localCache[str] === "NO_EXIST") {
      return null;
    }

    if(localCache[str]){
        return localCache[str];
    }

    const bMacthes =  match(bReg, str); //[]
    const pMacthes = match(pReg, str);  //()

    const hasB = (bMacthes && bMacthes.length > 0);
    const hasP = (pMacthes && pMacthes.length > 0);

    if(!hasB && !hasP){
        localCache[str] = "NO_EXIST";
        return;
    }

    let author = null;
    let group = null;
    let dateTag;
    let tags = [];

    // looking for author, avoid 6 year digit
    if (bMacthes && bMacthes.length > 0) {
        for (let ii = 0; ii < bMacthes.length; ii++) {
            let token = bMacthes[ii].trim();
            const tt = token.toLowerCase();
            if (token.length === 6 && isOnlyDigit(token) && isStrDate(token)) {
                //e.g 190214
                dateTag = token;
            } else if (not_author_but_tag_table[tt]){
                tags.push(token);
            } else {
                //  [真珠貝(武田弘光)]
                const temp = getAuthorName(token);
                if(not_author_but_tag_table[temp.name]){
                    tags.push(temp.name);
                }else{
                    author = temp.name;
                }
                group = temp.group;
                break;
            }
        }
    }

    if(!author && !group){
        localCache[str] = "NO_EXIST";
        return;
    }

    tags = tags.concat(getTag(str, pMacthes, author));
    const { comiket, type } = getTypeAndComiket(tags, group);

    let title = str;
    (bMacthes||[]).concat( pMacthes||[], tags||[], [/\[/g, /\]/g, /\(/g, /\)/g ]).forEach(e => {
        title = title.replace(e, "");
    })
    title = title.trim();

    const authors = author && author.includes("、")? author.split("、") : null;

    const result = {
       dateTag, author, tags, comiket, type, group, title, authors
    };

    localCache[str] = result;
    return result;
}

module.exports.parse = parse;
module.exports.isOnlyDigit = isOnlyDigit;
module.exports.all_comic_tags = all_comic_tags;
module.exports.getDateFromTags = getDateFromTags;
module.exports.getDateFromParse = getDateFromParse;
