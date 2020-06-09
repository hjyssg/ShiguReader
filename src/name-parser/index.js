const config = require("./name-parser-config");
const same_tags = config.same_tags;
const same_tag_regs_table = config.same_tag_regs_table;
const not_author_but_tag = config.not_author_but_tag;
const char_names = require("./character-names");
//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
const char_name_regex = new RegExp(char_names.join("|"));
const not_author_but_tag_regex =  new RegExp(not_author_but_tag.join("|"), "i");

const book_types = [
    "同人音声",
    "同人ソフト",
    "同人CG集",
    "同人ゲーム",
    "成年コミック",
    "一般コミック",
    "ゲームCG",
    "画集"
];
const book_type_regex = new RegExp(book_types.map(e => `(${e})`).join("|"), "i");

function isBookType(str){
    return !!str.match(book_type_regex);
}

function getBookType(str){
    return str.match(book_type_regex)[0];
}

const localCache = {};

const comicket_reg = /^C\d{2}$/i;
const comic_star_reg = /^COMIC1☆\d{1,2}$/i;
const love_live_event_reg = /^僕らのラブライブ!/i;
const comitea_reg = /^コミティア.*\d/;
const sankuri_reg = /^サンクリ.*\d+/;
const reitaisai_reg = /^例大祭.*\d+/;
const tora_reg = /^とら祭り.*\d+/;
const komitore_reg = /^こみトレ.*\d+/;
const reg_list = [comicket_reg, comic_star_reg, love_live_event_reg,
                 comitea_reg, sankuri_reg, reitaisai_reg,
                 tora_reg, komitore_reg, /みみけっと.*\d+/, 
                 /コミトレ.*\d+/, /FF\d+/, /iDOL SURVIVAL.*\d/i, 
                 /SC\d+/, /コミコミ.*\d/, /ふたけっと.*\d/,
                /ファータグランデ騎空祭/, /歌姫庭園/, /紅楼夢/];

const event_reg = new RegExp(reg_list.map(e => e.source).join("|"), "i");

function belongToEvent(e){
    return e.match(event_reg);
}

function init(){
    //--------------------------------------------
    const tag_convert_table = {};
    same_tags.forEach(row => {
        for(let ii = 1; ii < row.length; ii++){
            tag_convert_table[row[ii]] = row[0];
        }
    });

    const same_tag_reg_to_common_name = {};
    const same_tag_reg_array = [];
    for(let tag in same_tag_regs_table){
        if(same_tag_regs_table.hasOwnProperty(tag)){
            const reg_array = same_tag_regs_table[tag];

            const big_pre_join = reg_array.map(e =>e.source)
            const r =  new RegExp(big_pre_join.join("|"), 'i')

            same_tag_reg_array.push(r);
            same_tag_reg_to_common_name[r] = tag;
        }
    }

    same_tag_reg_array.sort((r1, r2) => {
        return r2.toString().length - r1.toString().length
    });

    //------------------------------------
    return {
        tag_convert_table,
        same_tag_reg_to_common_name,
        same_tag_reg_array
    }
}

const {
    tag_convert_table,
    same_tag_reg_to_common_name,
    same_tag_reg_array
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

    const _tags =  tags.filter(e => belongToEvent(e));
    let tag = _tags[0];
    if(!tag){  return; }

    let result = null;
    let num;
    let year;
    let month;
    
    if (tag_to_date_table[tag]) {
        result = tag_to_date_table[tag];
    } else if(tag.match(comicket_reg)) {
        tag = tag.replace("C", "");
        num = parseInt(tag);
        year = Math.floor(num /2) + 1971;
        const isSummer = num % 2 === 0;
        month = isSummer? 8 : 11;
        const day = isSummer? 10: 28;
        result = new Date(year, month, day);
        
    } else if(tag.match(comic_star_reg)) {
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

    if(result){
        tag_to_date_table[tag] = result;
    }

  return result;
}

function getDateFromStr(str){
    const mresult =  str.match(date_Reg);
    let [wm, y, m, d] = mresult;
    y = convertYearString(y);
    m = parseInt(m)-1;
    d = parseInt(d)||1;
    return new Date(y, m, d);
}

function convertYearString(str) {
    if(y.length === 2){
        y =  parseInt(y);
        if (y > 80) {
            y = 1900 + y;
        }else {
            y = 2000 + y;
        }
    }
    return y =  parseInt(y);;
}


const dreg1 = /(\d{2})(\d{2})(\d{2})/;
const dreg2 = /(\d{2})-(\d{2})-(\d{2})/;
const dreg3 = /(\d{4})-(\d{1,2})-(\d{2})/;
const dreg4 = /(\d{4})年(\d{1,2})月号/;
const dreg5 = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
const date_Reg = new RegExp([dreg1, dreg2, dreg3, dreg4, dreg5].map(e => e.source).join("|"), "i");
function isStrDate(str) {
    return !!str.match(date_Reg);
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

function isNotAuthor(str){
    return str.match(not_author_but_tag_regex);
}

const useless_tag = /RJ\d+|DL版|別スキャン^エロ|^digital$/i;
function isUselessTag(str){
    return !!str.match(useless_tag)
}


let pReg = /\((.*?)\)/g;
let bReg = /\[(.*?)\]/g;

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

    let author;
    let authors;
    let group;
    let dateTag;
    let comiket;
    let type;
    let tags = [];

    // looking for author, avoid 6 year digit
    if (bMacthes && bMacthes.length > 0) {
        for (let ii = 0; ii < bMacthes.length; ii++) {
            let token = bMacthes[ii].trim();
            const tt = token.toLowerCase();
            const nextCharIndex = str.indexOf(bMacthes[ii]) + bMacthes[ii].length + 1; 
            const nextChar = str[nextCharIndex];

            if(isBookType(token)){
                type = getBookType(token)
            }else if(isUselessTag(token)){
                continue;  //DLsite tag is not author
            } else if(belongToEvent(token)){
                comiket = token;
            }else if (isStrDate(token)) {
                //e.g 190214
                dateTag = token;
            } else if (isNotAuthor(tt)){
                //e.g pixiv is not author
                tags.push(token);
            } else if (nextChar === "." || nextCharIndex >= str.length){
                //e.g KI-RecenT SP02 NATURALCORDE [DL版].zip
                // [DL版] is not auhor name
                tags.push(token);
            } else if(!author) {
                //  [真珠貝(武田弘光)]
                const temp = getAuthorName(token);
                if(temp.name && !isNotAuthor(temp.name)){
                    //e.g よろず is not author
                    author = temp.name;
                    const seperator = /,|、|&|＆/;
                    authors = author && author.split(seperator).map(e => e.trim()) ;
                }
                group = temp.group;
            }else{
                tags.push(token);
            }
        }
    }

    if (pMacthes && pMacthes.length > 0) {
        tags = tags.concat(pMacthes);
    }

    const tseperator = /,|、/;
    const tempTags = [];
    tags.forEach(t => {
        t.split(tseperator).forEach(token => {
            tempTags.push(token);
        })
    })
    tags = tempTags;

    if(author && tags.indexOf(author) >= 0){
        tags.splice(tags.indexOf(author), 1);
    }

    tags = tags.filter(token=> {
        if(isBookType(token)){
            type = getBookType(token)
        }else if(isUselessTag(token)){
            return;
        } else if(belongToEvent(token)){
            comiket = token;
        }else if (isStrDate(token)) {
            //e.g 190214
            dateTag = token;
        }else{
            return true;
        }
    });

    tags = tags.map(e => {
        if(tag_convert_table[e]){
            return tag_convert_table[e]
        }

        for(let ii = 0; ii < same_tag_reg_array.length; ii++){
            const r = same_tag_reg_array[ii];
            if(e.match(r)){
                return same_tag_reg_to_common_name[r]
            }
        }
        return e;
    })

    tags = tags
        .map(e => e.trim())
        .filter(e => e.length > 1);

    if(!type){
        if(comiket|| group){
            type = "Doujin";
        }else{
            type = "etc";
        }
    }

    if(!author && !group && tags.length === 0){
        localCache[str] = "NO_EXIST";
        return;
    }

    let title = str;
    (bMacthes||[]).concat( pMacthes||[], tags||[], [/\[/g, /\]/g, /\(/g, /\)/g ]).forEach(e => {
        title = title.replace(e, "");
    })
    title = title.trim();

    const names = char_name_regex && title.match(char_name_regex);
    names && names.forEach(e => {
        tags.push(e);
    })

    const result = {
       dateTag, group, author, authors, tags, comiket, type, title,
    //    get author(){
    //        return this.authors.join(",")
    //    }
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
module.exports.getDateFromTags = getDateFromTags;
module.exports.getDateFromParse = getDateFromParse;
module.exports.parseMusicTitle = parseMusicTitle;
