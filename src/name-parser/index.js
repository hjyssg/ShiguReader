const config = require("./name-parser-config");
const same_tags = config.same_tags;
const not_author_but_tag = config.not_author_but_tag;
const char_names = require("./character-names");
//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
const char_name_regex = new RegExp(char_names.join("|"));


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
    if(isFullStrDate(str)){
        const tokens = str.split("-");
        let y = parseInt(tokens[0]);
        let m = parseInt(tokens[1]);
        let d = parseInt(tokens[2]);

        m = m - 1;
        return new Date(y, m, d);
    }else{
        let y = convertYearString(str);
        let m = parseInt(str.slice(2, 4));
        let d = parseInt(str.slice(4, 6));
    
        m = m - 1;
        return new Date(y, m, d);
    }
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


const dreg1 = /\d{6}/;
const dreg2 = /\d{2}-\d{2}-\d{2}/;
const dreg3 = /\d{4}年\d{1,2}月\d{1,2}日/;
const dreg4 = /\d{4}年\d{1,2}月号/;


function isStrDate(str) {
    if (str && str.length === 6 && str.match(dreg1)) {
        const y = parseInt(str.slice(0, 2));
        const m = parseInt(str.slice(2, 4));
        const d = parseInt(str.slice(4, 6));

        let invalid = y > 30 && y < 80;
        invalid = invalid || (m < 0 || m > 12);
        invalid = invalid || (d < 0 || d > 31);
        return !invalid;
    }else if(str.match(dreg2)){
        return true;
    }else if(str.match(dreg3)){
        return true;
    }else if(str.match(dreg4)){
        return true;
    }

    return isFullStrDate(str);
}

const fullDateReg = /\d{4}-\d{1,2}-\d{2}/;

function isFullStrDate(str){
    //e.g 2014-04-01
    return !!(str && str.match(fullDateReg));
}

function getAuthorName(str){
    var macthes = str.match(/^(.*?)\s*\((.*?)\)$/);
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
        tags = tags.filter(e=> {return !isOnlyDigit(e) && !isStrDate(e)   });
    }

    if(author && tags.indexOf(author) >= 0){
        tags.splice(tags.indexOf(author), 1);
    }

    const names = char_name_regex && str.match(char_name_regex);
    names && names.forEach(e => {
        tags.push(e);
    })

    tags = tags.map(e => {
        return convert_table[e] || e;
    })

    return tags;
}

const DLsiteReg = /RJ\d+/;

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
            const nextCharIndex = str.indexOf(bMacthes[ii]) + bMacthes[ii].length + 1; 
            const nextChar = str[nextCharIndex];

            if(token.match(DLsiteReg)){
                //DLsite tag is not author
                continue;
            }else if (isStrDate(token)) {
                //e.g 190214
                dateTag = token;
            } else if (not_author_but_tag_table[tt]){
                //e.g pixiv is not author
                tags.push(token);
            } else if (nextChar === "." || nextCharIndex >= str.length){
                //e.g KI-RecenT SP02 NATURALCORDE [DL版].zip
                // [DL版] is not auhor name
                tags.push(token);
            } else if(!author) {
                //  [真珠貝(武田弘光)]
                const temp = getAuthorName(token);
                if(!not_author_but_tag_table[temp.name]){
                    //e.g よろず is not author
                    author = temp.name;
                }
                group = temp.group;
            }else{
                tags.push(token);
            }
        }
    }

    const tseperator = /,|、/;
    tags = tags.concat(getTag(str, pMacthes, author));
    let tempTags = [];
    tags.forEach(t => {
        t.split(tseperator).forEach(token => {
            tempTags.push(token);
        })
    })
    tags = tempTags;
    tags = tags.filter(e => e.length > 1);
    if(!author && !group && tags.length === 0){
        localCache[str] = "NO_EXIST";
        return;
    }

    const { comiket, type } = getTypeAndComiket(tags, group);

    let title = str;
    (bMacthes||[]).concat( pMacthes||[], tags||[], [/\[/g, /\]/g, /\(/g, /\)/g ]).forEach(e => {
        title = title.replace(e, "");
    })
    title = title.trim();

    const seperator = /,|、|&|＆/;
    const authors = author && author.split(seperator).map(e => e.trim()) ;

    const result = {
       dateTag, author, tags, comiket, type, group, title, authors
    };

    localCache[str] = result;
    return result;
}

function parseMusicTitle(str){
    // [161109] TVアニメ「ラブライブ！サンシャイン!!」挿入歌シングル3「想いよひとつになれ／MIRAI TICKET」／Aqours [320K].zip
    //[180727]TVアニメ『音楽少女』OPテーマ「永遠少年」／小倉唯[320K].rar
    let jpbReg = /「(.*?)」/g;
    const macthes =  match(jpbReg, str) || [];

    let jpbReg2 = /『(.*?)』/g;
    const macthes2 =  match(jpbReg2, str) || [];

    return (macthes.concat(macthes2)).map(e => {
       return e.trim();
    })
}

module.exports.parse = parse;
module.exports.isOnlyDigit = isOnlyDigit;
module.exports.all_comic_tags = all_comic_tags;
module.exports.getDateFromTags = getDateFromTags;
module.exports.getDateFromParse = getDateFromParse;
module.exports.parseMusicTitle = parseMusicTitle;
