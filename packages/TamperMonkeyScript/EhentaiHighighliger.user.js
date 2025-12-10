// ==UserScript==
// @name        EhentaiLight配合Shigureader
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
// @connect     localhost
// @namespace       Aji47
// @version         0.0.30
// @description
// @author        Aji47
// @include       *://exhentai.org/*
// @include       *://g.e-hentai.org/*
// @include       *://e-hentai.org/*
// @include       *://sukebei.nyaa.si/*
// @include       *://sukebei.nyaa.si
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11.7.5/dist/sweetalert2.all.min.js
// ==/UserScript==

/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 697:
/***/ ((module) => {

module.exports =[
//kankore  http://dunkel.halfmoon.jp/kancolle/
"長門",
"陸奥",
"伊勢",
"日向",
"雪風",
"赤城",
"加賀",
"蒼龍",
"飛龍",
"島風",
"吹雪",
"白雪",
"初雪",
"深雪",
"叢雲",
"磯波",
"綾波",
"敷波",
"大井",
"北上",
"金剛",
"比叡",
"榛名",
"霧島",
"鳳翔",
"扶桑",
"山城",
"天龍",
"龍田",
"龍驤",
"睦月",
"如月",
"皐月",
"文月",
"長月",
"菊月",
"三日月",
"望月",
"球磨",
"多摩",
"木曾",
"長良",
"五十鈴",
"名取",
"由良",
"川内",
"神通",
"那珂",
"千歳",
"千代田",
"最上",
"古鷹",
"加古",
"青葉",
"妙高",
"那智",
"足柄",
"羽黒",
"高雄",
"愛宕",
"摩耶",
"鳥海",
"利根",
"筑摩",
"飛鷹",
"隼鷹",
"朧",
"曙",
"漣",
"潮",
"暁",
"響",
"雷",
"電",
"初春",
"子日",
"若葉",
"初霜",
"白露",
"時雨",
"村雨",
"夕立",
"五月雨",
"涼風",
"朝潮",
"大潮",
"満潮",
"荒潮",
"霰",
"霞",
"陽炎",
"不知火",
"黒潮",
"祥鳳",
"千歳甲",
"千代田甲",
"千歳航",
"千代田航",
"翔鶴",
"瑞鶴",
"鬼怒",
"阿武隈",
"夕張",
"瑞鳳",
"三隈",
"初風",
"舞風",
"衣笠",
"伊19",
"鈴谷",
"熊野",
"伊168",
"伊58",
"伊8",
"大和",
"秋雲",
"夕雲",
"巻雲",
"長波",
"阿賀野",
"能代",
"矢矧",
"酒匂",
"武蔵",
"Верный",
"大鳳",
"香取",
"伊401",
"あきつ丸",
"神威",
"まるゆ",
"弥生",
"卯月",
"磯風",
"浦風",
"谷風",
"浜風",
"Bismarck",
"Bismarck zwei",
"Z1",
"Z3",
"Prinz Eugen",
"Bismarck drei",
"Z1 zwei",
"Z3 zwei",
"天津風",
"明石",
"大淀",
"大鯨",
"龍鳳",
"時津風",
"雲龍",
"天城",
"葛城",
"春雨",
"早霜",
"清霜",
"朝雲",
"山雲",
"野分",
"秋月",
"照月",
"初月",
"高波",
"朝霜",
"U-511",
"Graf Zeppelin",
"Saratoga",
"呂500",
"Warspite",
"Iowa",
"Littorio",
"Roma",
"Libeccio",
"Aquila",
"秋津洲",
"Italia",
"Zara",
"Pola",
"瑞穂",
"沖波",
"風雲",
"嵐",
"萩風",
"親潮",
"山風",
"海風",
"江風",
"速吸",
"鹿島",
"神風",
"朝風",
"春風",
"松風",
"旗風",
"天霧",
"狭霧",
"水無月",
"伊26",
"浜波",
"藤波",
"浦波",
"Commandant Teste",
"Richelieu",
"伊400",
"伊13",
"伊14",
"Zara due",
"Гангут",
"Ташкент",
"Ark Royal",
"Гангут два",
"占守",
"国後",
"Jervis",
"春日丸",
"神鷹",
"Luigi Torelli",
"大鷹",
"岸波",
"UIT-25",
"伊504",
"涼月",
"択捉",
"松輪",
"佐渡",
"対馬",
"日振",
"大東",
"福江",
"Nelson",
"Gotland",
"Maestrale",

"穂乃果",
"ことり",

"エルフ"
].filter(e => e.length > 1);


/***/ }),

/***/ 908:
/***/ ((module) => {

// https://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
function editDistance(s, t) {
    if (s === t) {
        return 0;
    }
    var n = s.length, m = t.length;
    if (n === 0 || m === 0) {
        return n + m;
    }
    var x = 0, y, a, b, c, d, g, h, k;
    var p = new Array(n);
    for (y = 0; y < n;) {
        p[y] = ++y;
    }

    for (; (x + 3) < m; x += 4) {
        var e1 = t.charCodeAt(x);
        var e2 = t.charCodeAt(x + 1);
        var e3 = t.charCodeAt(x + 2);
        var e4 = t.charCodeAt(x + 3);
        c = x;
        b = x + 1;
        d = x + 2;
        g = x + 3;
        h = x + 4;
        for (y = 0; y < n; y++) {
            k = s.charCodeAt(y);
            a = p[y];
            if (a < c || b < c) {
                c = (a > b ? b + 1 : a + 1);
            }
            else {
                if (e1 !== k) {
                    c++;
                }
            }

            if (c < b || d < b) {
                b = (c > d ? d + 1 : c + 1);
            }
            else {
                if (e2 !== k) {
                    b++;
                }
            }

            if (b < d || g < d) {
                d = (b > g ? g + 1 : b + 1);
            }
            else {
                if (e3 !== k) {
                    d++;
                }
            }

            if (d < g || h < g) {
                g = (d > h ? h + 1 : d + 1);
            }
            else {
                if (e4 !== k) {
                    g++;
                }
            }
            p[y] = h = g;
            g = d;
            d = b;
            b = c;
            c = a;
        }
    }

    for (; x < m;) {
        var e = t.charCodeAt(x);
        c = x;
        d = ++x;
        for (y = 0; y < n; y++) {
            a = p[y];
            if (a < c || d < c) {
                d = (a > d ? d + 1 : a + 1);
            }
            else {
                if (e !== s.charCodeAt(y)) {
                    d = c + 1;
                }
                else {
                    d = c;
                }
            }
            p[y] = d;
            c = a;
        }
        h = d;
    }

    return h;
}

function getExtraTags(str) {
    // [161109] TVアニメ「ラブライブ！サンシャイン!!」挿入歌シングル3「想いよひとつになれ／MIRAI TICKET」／Aqours [320K].zip
    //[180727]TVアニメ『音楽少女』OPテーマ「永遠少年」／小倉唯[320K].rar
    let jpbReg = /「(.*?)」/g;
    const macthes = matchAll(jpbReg, str) || [];

    let jpbReg2 = /『(.*?)』/g;
    const macthes2 = matchAll(jpbReg2, str) || [];

    return (macthes.concat(macthes2)).map(e => {
        return e.trim();
    })
}

function compareInternalDigit(s1, s2) {
    const digitTokens1 = s1.match(/\d+/g);
    const digitTokens2 = s2.match(/\d+/g);
    if (digitTokens1 && digitTokens2) {
        if (digitTokens1.length !== digitTokens2.length ||
            digitTokens1.join() !== digitTokens2.join()) {
            return false;
        }
    } else if (digitTokens1 && !digitTokens2) {
        return false;
    } else if (!digitTokens1 && digitTokens2) {
        return false;
    }
    return true;
}

function isHighlySimilar(s1, s2) {
    if (!s1 && !s2) {
        return true;
    } else if (s1 && s2) {
        if (!compareInternalDigit(s1, s2)) {
            return false;
        }

        const distance = editDistance(s1, s2);
        const avgLen = (s1.length + s2.length) / 2;
        const ratio = distance / (Math.ceil(avgLen));

        return ratio <= 0.2;
    } else {
        return false;
    }
}

function matchAll(reg, str) {
    const result = [];
    var token = reg.exec(str);
    while (token) {
        if(token[1]){
            result.push(token[1]);
        }
        token = reg.exec(str);
    }
    return result;
}

module.exports = {
    editDistance,
    getExtraTags,
    compareInternalDigit,
    isHighlySimilar,
    matchAll
}

/***/ }),

/***/ 951:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const config = __webpack_require__(965);
const same_tag_regs_table = config.same_tag_regs_table;
const not_author_but_tag = config.not_author_but_tag;
const char_names = __webpack_require__(697);
//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
const char_name_regex = new RegExp(char_names.join("|"));
const not_author_but_tag_regex = new RegExp(not_author_but_tag.join("$|") + "$", "i");
const util = __webpack_require__(908);
const { editDistance, getExtraTags, isHighlySimilar, matchAll } = util;

const useless_tag_regex = /DL版|同人誌|別スキャン|修正版|^エロ|^digital$|^JPG|^PNG|ページ補足|進行中|別版|Various/i;
function isUselessTag(str) {
    return !!str.match(useless_tag_regex)
}

const media_types = [
    "同人音声",
    "同人催眠音声",
    "同人ソフト",
    "同人CG集",
    "同人CG",
    "同人ゲーム",
    "同人GAME",
    "成年コミック",
    "一般コミック",
    "一般漫画",
    "ゲームCG",
    "イラスト集",
    "アンソロジー",
    "画集",
    "雑誌",
    "18禁ゲーム",
    "GAME",
    "CG",
    "同人誌",
    "DOUJINSHI"
];
const media_type_regex = new RegExp(media_types.map(e => `(${e})`).join("|"), "i");

function isMediaType(str) {
    return !!str.match(media_type_regex);
}

function getMediaType(str) {
    let res = str.match(media_type_regex) || [];
    return res[0];
}

const same_tag_matrix = [];
for (let tag in same_tag_regs_table) {
    if (same_tag_regs_table.hasOwnProperty(tag)) {
        const big_pre_join = same_tag_regs_table[tag].map(e => e.source)
        const r = new RegExp(big_pre_join.join("|"), 'i')
        const row = [r, tag];
        same_tag_matrix.push(row);
    }
}
same_tag_matrix.sort((r1, r2) => {
    return r2[1].length - r1[1].length
});

const localCache = {};

const comicket_reg = /^C\d{2}$/i;
const comicket_reg_2 = /^C1\d{2}$/i;
const air_comicket_reg = /^エアコミケ\d{1}$/i;
const comic_star_reg = /^COMIC1☆\d{1,2}$/i;
const love_live_event_reg = /^僕らのラブライブ!/i;
const comitea_reg = /^コミティア.*\d/;
const sankuri_reg = /^サンクリ.*\d+/;
const reitaisai_reg = /^例大祭.*\d+/;
const tora_reg = /^とら祭り.*\d+/;
const komitore_reg = /^こみトレ.*\d+/;
const reg_list = [comicket_reg_2, comicket_reg, air_comicket_reg, comic_star_reg, love_live_event_reg,
    comitea_reg, sankuri_reg, reitaisai_reg,
    tora_reg, komitore_reg, /みみけっと.*\d+/,
    /コミトレ.*\d+/, /FF\d+/, /iDOL SURVIVAL.*\d/i,
    /SC\d+/, /コミコミ.*\d/, /ふたけっと.*\d/,
    /ファータグランデ騎空祭/, /歌姫庭園/, /紅楼夢/,
    /CSP\d/, /CC大阪\d/, /COMITIA\d/];

const event_reg = new RegExp(reg_list.map(e => e.source).join("|"), "i");

function belongToEvent(str) {
    return !!str.match(event_reg);
}

const comiket_to_date_table = {};
function getDateFromParse(str) {
    const pp = parse(str);
    let result;
    if (pp) {
        if (pp.dateTag) {
            result = getDateFromStr(pp.dateTag);
        } else if (pp.comiket) {
            result = getDateFromComiket(pp.comiket)
        }
    }
    return result;
}

//for sort algo, not very accurate
function getDateFromComiket(comiket) {
    let result = null;
    let num;
    let year;
    let month;

    if (comiket_to_date_table[comiket]) {
        result = comiket_to_date_table[comiket];
    } else if (comiket.match(comicket_reg_2)) {
        comiket = comiket.replace("C", "");
        num = parseInt(comiket) - 100;
        result = new Date(2022, 8, 13); // C100

        year = Math.floor(num / 2) + 2022;
        const isSummer = num % 2 === 0;
        month = isSummer ? 8 : 11;
        const day = isSummer ? 10 : 28;
        result = new Date(year, month, day);
    } else if (comiket.match(comicket_reg)) {
        comiket = comiket.replace("C", "");
        num = parseInt(comiket);
        year = Math.floor(num / 2) + 1971;
        const isSummer = num % 2 === 0;
        month = isSummer ? 8 : 11;
        const day = isSummer ? 10 : 28;
        result = new Date(year, month, day);
    } else if (comiket.match(air_comicket_reg)) {
        comiket = comiket.replace("エアコミケ", "");
        num = parseInt(comiket);
        if (num === 1) {
            result = new Date(2020, 7, 30);
        } else {
            result = new Date(2020, 11, 30);
        }
    } else if (comiket.match(comic_star_reg)) {
        comiket = comiket.replace("COMIC1☆", "");
        num = parseInt(comiket);
        if (num <= 10) {
            //once per year
            result = new Date(2006 + num, 3, 30);
        } else {
            num = (num - 10)
            year = 2017 + Math.floor(num / 2);
            month = num % 2 === 0 ? 10 : 4;
            result = new Date(year, month, 30);
        }
    }

    if (result) {
        comiket_to_date_table[comiket] = result;
    }
    return result;
}

const currentYear = (new Date()).getFullYear();
function getDateFromStr(str) {
    const mresult = str.match(date_reg);
    if (mresult) {
        let [wholeMatch, y, m, d] = mresult.filter(e => !!e);
        y = convertYearString(y);
        m = parseInt(m) - 1;
        d = parseInt(d) || 1;

        if (m < 0 || m > 11) {
            return undefined;
        } else if (d < 1 || d > 31) {
            return undefined;
        }if (y > currentYear + 2 || y < 1970){
            return undefined;
        }

        return new Date(y, m, d);
    }
}

function convertYearString(y) {
    if (y.length === 2) {
        y = parseInt(y);
        if (y > 70) {
            y = 1900 + y;
        } else {
            y = 2000 + y;
        }
    } else {
        y = parseInt(y)
    }

    return y;
}


function isDateValid(date) {
    // An invalid date object returns NaN for getTime() and NaN is the only
    // object not strictly equal to itself.
    return date.getTime() === date.getTime();
};

const dreg0 = /(\d{4})(\d{1,2})(\d{2})/;
const dreg1 = /(\d{2})(\d{2})(\d{2})/;
const dreg2 = /(\d{2})-(\d{2})-(\d{2})/;
const dreg3 = /(\d{4})-(\d{1,2})-(\d{2})/;
const dreg4 = /(\d{4})年(\d{1,2})月号/;
const dreg5 = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
const dreg6 = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const date_reg = new RegExp([dreg0, dreg1, dreg2, dreg3, dreg4, dreg5, dreg6].map(e => e.source).join("|"), "i");
function isStrDate(str) {
    if (str.match(date_reg)) {
        const dd = getDateFromStr(str);
        return !!(dd && isDateValid(dd));
    }
}

const groupAndNameReg = /^(.*?)\s*\((.*?)\)$/;
function getGroupAndName(str) {
    var macthes = str.match(groupAndNameReg);
    if (macthes && macthes.length > 0) {
        return {
            group: macthes[1].trim(),
            name: macthes[2].trim(),
        };
    } else {
        return {
            name: str.trim(),
        };
    }
}


function isNotAuthor(str) {
    return str.match(not_author_but_tag_regex);
}

function findMaxStr(arr) {
    let res = arr[0];
    arr.forEach(e => {
        if (e.length > res.length) {
            res = e;
        }
    })
    return res;
}

const pReg = /\((.*?)\)/g;
const bReg = /\[(.*?)\]/g;
const seperator = /,|、|&|＆/;

function getLocalCache(){
    return localCache;
}

function setLocalCache(newLocache){
    for (var key in newLocache) {
        if (!newLocache.hasOwnProperty(key)) {
            continue;
        }
        var obj = newLocache[key];
        localCache[key] = obj;
    }
}

function parse(str) {
    if (!str || localCache[str] === "NO_EXIST") {
        return null;
    }

    if (localCache[str]) {
        return localCache[str];
    }

    const bMacthes = matchAll(bReg, str); //[]
    const pMacthes = matchAll(pReg, str);  //()

    const hasB = (bMacthes && bMacthes.length > 0);
    const hasP = (pMacthes && pMacthes.length > 0);

    if (!hasB && !hasP) {
        localCache[str] = "NO_EXIST";
        return;
    }

    let author;
    let authors = [];
    let group;
    let dateTag;
    let comiket;
    let type;
    let tags = [];

    function isOtherInfo(token) {
        let result = false;
        if (isMediaType(token)) {
            type = getMediaType(token);
            result = true;
        } else if (belongToEvent(token)) {
            comiket = token;
            result = true;
        } else if (isStrDate(token)) {
            dateTag = token;  //e.g 190214
            result = true;
        } else if (isUselessTag(token)) {
            //nothing
            result = true;
        }
        return result;
    }

    // looking for author, avoid 6 year digit
    if (bMacthes && bMacthes.length > 0) {
        for (let ii = 0; ii < bMacthes.length; ii++) {
            let token = bMacthes[ii].trim();
            const tt = token.toLowerCase();
            const nextCharIndex = str.indexOf(bMacthes[ii]) + bMacthes[ii].length + 1;
            const nextChar = str[nextCharIndex];

            if (isOtherInfo(token)) {
                continue;
            } if (isNotAuthor(tt)) {
                //e.g pixiv is not author
                tags.push(token);
            } else if (nextChar === "." || nextCharIndex >= str.length) {
                //e.g KI-RecenT SP02 NATURALCORDE [DL版].zip
                // [DL版] is not auhor name
                tags.push(token);
            } else if (!author) {
                //  [真珠貝(武田弘光)]
                const temp = getGroupAndName(token);
                if (temp.name && !isNotAuthor(temp.name)) {
                    //e.g よろず is not author
                    author = temp.name;
                    authors = author.split(seperator).map(e => e.trim());
                }
                group = temp.group;
            } else {
                tags.push(token);
            }
        }
    }

    //---------------handle tags
    if (pMacthes && pMacthes.length > 0) {
        tags.push(...pMacthes);
    }

    //seperate
    const tseperator = /,|、/;
    const tempTags = [];
    tags.forEach(t => {
        tempTags.push(...(t.split(tseperator)));
    })
    tags = tempTags;


    tags = tags.map(e => e.trim());

    tags = tags.filter(e => {
        return e.length > 1 && !isOtherInfo(e) && authors.indexOf(e) === -1 && e !== author;
    });

    tags = tags.filter(e => {
        return  !isUselessTag(e) && !isMediaType(e);
    })

    const rawTags = tags.slice();

    tags = tags.map(e => {
        e = e.replace(/ {2,}/g, " ").replace(/。/g, "").replace(/！/g, "!").replace(/？/g, "?");

        //tag reducing
        const converts = [];
        for (let ii = 0; ii < same_tag_matrix.length; ii++) {
            const row = same_tag_matrix[ii];
            const r = row[0];
            if (e.match(r)) {
                converts.push(row[1]);
            }
        }

        if (converts.length > 0) {
            return findMaxStr(converts);
        } else {
            return e;
        }
    })

    if (!type) {
        if (comiket || group) {
            type = "同人誌";
        } else {
            type = "UNKOWN";
        }
    }

    if (!author && !group && tags.length === 0) {
        localCache[str] = "NO_EXIST";
        return;
    }

    //get title
    let title = str;
    (bMacthes || []).concat(pMacthes || [], rawTags || [], [/\[/g, /\]/g, /\(/g, /\)/g]).forEach(e => {
        title = title.replace(e, "");
    })
    if(title.includes(".")){
        title = title.split(".")[0];
    }
    title = title.trim();

    //get character names
    let charNames = [];
    if(char_name_regex ){
        const names = title.match(char_name_regex);
        if(names){
            charNames.push(...names);
        }
    }

    const extraTags = getExtraTags(title);
    const result = {
        // 日期tag：比如 20220312
        dateTag,
        // 同人的group
        group,
        // 作者。其实有点不对，因为有的是有多作者的
        author,
        // 作者list
        authors,
        // tags 已过变形处理
        tags,
        // 用regex从string找到的角色名字
        charNames,
        // extrac tags
        extraTags,
        // 未经转换的tags
        rawTags,
        // 比如 c101
        comiket,
        // 类型
        type,
        // 标题
        title
    };

    localCache[str] = result;
    return result;
}


module.exports = {
    isUselessTag,
    isMediaType,
    getMediaType,
    belongToEvent,
    convertYearString,
    editDistance,
    getDateFromStr,

    parse,
    getDateFromComiket,
    getDateFromParse,
    getLocalCache,
    setLocalCache,
    isHighlySimilar,
}





/***/ }),

/***/ 965:
/***/ ((module) => {

module.exports.same_tag_regs_table = {
    "東方Project": [/^東方$/, /Touhou\s*Project/, /東方project/],
    "オリジナル": [/^Original$/],
    "Kanon": [/カノン|Kanon/],
    "艦これ": [/艦これ|舰これ/, /艦隊これくしょん/, /Kantai\s*Collection/, /KanColle/],
    "ラブライブ!": [/Love Live/, /ラブライブ/],
    "ラブライブ!サンシャイン!!": [/ラブライブ.*サンシャイン.*/],
    "プリンセスコネクト!Re:Dive": [/プリンセスコネクト.*Re.*Dive/],
    "Fate／Grand Order": [/Fate.*Grand.*Order/, /FGO/],
    "Fate／Stay Night": [/Fate.*Stay.*Night/],
    "Fate／Zero": [/Fate.*Zero/],
    "Fate／kaleid liner プリズマ☆イリヤ": [/Fate.*kaleid.*liner.*プリズマ.*イリヤ/, /Fate.*kaleid.*liner/, /プリズマ.*イリヤ/],
    "Fate": [/^Fate\s*／*\w+/],
    "アイドルマスター": [/アイドルマスタ/, /DOL.*M@STER/, /dol.*master/, /アイマス/],
    "アイドルマスター シンデレラガールズ": [/アイドルマスター.*シンデレラガールズ/, /DOLM@STER.*CINDERELLA.*GIRLS/],
    "アイドルマスター ミリオンライブ": [/アイドルマスター.*ミリオン/, /ミリオンライブ/],
    "アイドルマスター シャイニーカラーズ": [/アイドルマスター.*シャイニーカラーズ/],
    "アズールレーン": [/Azur Lane/],
    "ガールズ&パンツァー": [/Girls.*nd.*Panzer/],
    "けいおん": [/けいおん/, /K-ON/],
    "プリキュア": [/プリキュア/],
    "To LOVEる": [/To.*LOVEる/, /To.*LOVE.*ru/],
    "魔法少女まどか☆マギカ": [/まどか.*マギカ|PuellaMagiMadoka/],
    "アイカツ!": [/アイカツ.*/],
    "エヴァンゲリオン": [/エヴァンゲリオン/, /^エヴァ$/, /Evangelion/],
    "Angel Beats": [/Angel.*Beats.*/, /エンジェル.*ビーツ/],
    "Dead Or Alive": [/Dead Or Alive/, /デッド.*オア.*アライヴ/, /DEADorALIVE/],
    "IS ＜インフィニット・ストラトス＞": [/S.*インフィニット.*ストラトス.*/, /インフィニット.*ストラトス/],
    "D.C～ダ・カーポ": [/D\.C\./, /ダ.*カーポ/],
    "Dog Days": [/Dog.*Days.*/],
    "Dream C Club": [/Dream.*C.*Club/],
    "ガンダム ": [/ガンダム|gundam/],
    "コードギアス": [/コードギアス/],
    "ご注文はうさぎですか": [/ご注文はうさぎですか/],
    "ソードアート・オンライン": [/ソードアート.*オンライン/, /Sword\s*Art\s*Online/],
    "ダンガンロンパ": [/ダンガンロンパ/],
    "ドラゴンクエスト": [/ドラゴンクエスト/, /Dragon\s*Quest/],
    "ファイナルファンタジー": [/ファイナルファンタジー|FinalFantasy/],
    "咲 -Saki-": [/咲.*Saki.*/],
    "咲-Saki- 阿知賀編": [/咲.*Saki.*阿知賀編/],
    "聖剣伝説": [/聖剣伝説/],
    "閃乱カグラ": [/閃乱カグラ/],
    "魔法少女リリカルなのは": [/魔法少女リリカルなのは.*|Nanoha$|^なのは$/],
    "キング・オブ・ファイター": [/キング\.オブ\.ファイター/, /^KOF$/],
    "ファイアーエムブレム": [/ファイアーエムブレム/],
    "ファンタシースター": [/ファンタシースター|PhantasyStar/],
    "To Heart 2": [/To.*Heart.*2|トゥハート2/]
}

module.exports.not_author_but_tag = [
    "同人音声",
    "同人誌",
    "アンソロジー",
    "DL版",
    "よろず",
    "成年コミック",
    "Pixiv",
    "アーティスト",
    "雑誌",
    "English",
    "Chinese",
    "320K"
]


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
const { parse } = __webpack_require__(951);

//tamper monkey自动缓存require脚本，随便改一下版本号就可以更新

GM_addStyle(`
.shigureader_link {
    font-size: 12px;
    text-decoration:none;
    text-align: center;
}

.shigureader_link:hover {
       color: #b0f3ff
}

.gl1t {
    position: relative;
}

.disappear_dom {
    opacity: 0.3;
    transition: opacity 0.3s;
}
.disappear_dom:hover {
    opacity: 1 !important;
}

`);

const IS_EHENTAI = window.location.hostname.includes("exhentai") || window.location.hostname.includes("e-hentai");
const IS_NYAA =  window.location.hostname.includes("nyaa");

console.assert = console.assert || (() => { });

//-------------------------------
const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;
const TOTALLY_DIFFERENT = 0;

let isServerUp = true;

async function postData(method, url, data) {
    data = data || {};
    const header = {
        method: method, 
        // mode: "no-cors",
        cache: "no-cache",
        headers: {
            //   "Content-Type": "application/json",
        },
        body: JSON.stringify(data), 
    };
    const response = await fetch(url, header);
    // const text =  await response.text();
    // console.log(text)
    if(response.type == "opaque"){
        debugger
    }
    const json =  await response.json();
    // console.log(json);
    return json;
}

async function checkIfDownload(text) {
    var status = 0;
    let similarTitles = [];

    if (!isServerUp) {
        return {
            status,
            similarTitles
        };
    }

    try{
        let api = `http://localhost:${production_port}/api/search/find_similar_file/${encodeURIComponent(text)}`;
        // let res = await GM_xmlhttpRequest_promise("POST", api);
        let res = await postData("POST", api);
        const data = res;
        similarTitles = data.map(e => e.fn);
        status = data[0]?.score || 0;
    } catch(e) {
        isServerUp = false;
        console.error(e);
    } finally {
        // console.table({
        //     status,
        //     similarTitles
        // });
    }

    return {
        status,
        similarTitles
    }
}


//--------------------------------------------------------------
let is_list_page = false;

async function highlightEhentaiThumbnail() {
    let nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));

    if (!nodes || nodes.length === 0) {
        return;
    }

    is_list_page = true;
    console.time("check_all_dom");
    for (let ii = 0; ii < nodes.length; ii++){
        const e = nodes[ii];
        try {
            const subNode = e.getElementsByClassName("gl4t")[0];
            const thumbnailNode = e.getElementsByTagName("img")[0];
            const text = subNode.textContent;

            e.status = 0;
            if (text.includes("翻訳") || text.includes("翻译")) {
                continue;
            }
            console.log(`${ii}/${nodes.length}  ${text}`)
            const rr = parse(text);
            const { status, similarTitles } = await checkIfDownload(text);
            e.status = status || 0;
            if (status === IS_IN_PC) {
                subNode.style.color = "#61ef47";
                addTooltip(thumbnailNode, "明确已经下载过了", similarTitles)
            } else if (status === LIKELY_IN_PC) {
                subNode.style.color = "#efd41b";
                addTooltip(thumbnailNode, "电脑里面好像有", similarTitles)
            } else if (status === SAME_AUTHOR) {
                subNode.style.color = "#ef8787";
                const fns = similarTitles;
                const authorName = rr && rr.author ? rr.author : "这位作者";
                addTooltip(thumbnailNode, `下载同样作者“${authorName}”的书 ${fns.length}次`, fns, "same_author")
            }

            appendSimilarLink(e, text);
            if (rr) {
                if (rr.author) {
                    // appendLink(e, rr.author);
                }
                if (rr.title) {
                    // appendLink(e, rr.title);
                }
            } else {
                // appendLink(e, text);
            }
            subNode.style.fontWeight = 600;
        } catch (e) {
            console.error(e);
        }
    };
    console.timeEnd("check_all_dom");
}

async function highlightNyaa(){
    const  nodes = Array.prototype.slice.call(document.querySelectorAll(".table-bordered tr td:nth-child(2) a"))
    if (!nodes || nodes.length === 0) {
        return;
    }
    is_list_page = true;

    console.time("check_all_dom");
    for (let ii = 0; ii < nodes.length; ii++){
        const node = nodes[ii];
        try {
            const text = node.textContent;
            const { status, similarTitles } = await checkIfDownload(text);
            if (status === IS_IN_PC) {
                node.style.textDecoration = "line-through";
                node.style.textDecorationColor = "green";
                addTooltip(node, "明确已经下载过了", similarTitles)
            } else if (status === LIKELY_IN_PC) {
                node.style.color = "#efd41b";
                addTooltip(node, "电脑里面好像有", similarTitles)
            } else if (status === SAME_AUTHOR) {
                node.style.color = "#ef8787";
                const rr = parse(text);
                const fns = similarTitles; 
                addTooltip(node, `下载同样作者“${rr.author}”的书 ${fns.length}次`, fns, "same_author")
            }
        } catch (e) {
            console.error(e);
        }
    };
    console.timeEnd("check_all_dom");
}

function addTooltip(node, title, books) {
    books.sort();
    //indent
    books = books.map((e, ii) => {
        let tt = ii + 1;
        if (tt < 10) {
            tt = "0" + tt;
        }
        const t1 = "  " + tt + ".  ";
        return t1 + e;
    });
    if (books.length > 25) {
        books = books.slice(0, 10).concat("...");
    }
    node.title = [node.title, " ", title, "  ",].concat(books).join("\n");
}

function appendLink(fileTitleDom, text, asIcon) {
    if(!isServerUp){
        return;
    }
    var link = document.createElement("a");

    if (asIcon) {
        link.textContent = "🔍";
    } else {
        link.textContent = `Search ${text} in PC`;
    }

    link.style.display = "block";
    fileTitleDom.append(link);
    link.target = "_blank"
    link.className = "shigureader_link";
    link.href = `http://localhost:${production_port}/search/?s=${text}`;
}

function appendSimilarLink(fileTitleDom, text) {
    if(!isServerUp){
        return;
    }

    const trimmed = (text || "").trim();
    if (!trimmed) {
        return;
    }

    const link = document.createElement("a");
    link.textContent = "Find in ShiguReader";
    link.title = trimmed;
    link.style.display = "block";
    link.style.marginTop = "8px";
    link.style.marginBottom = "8px";
    link.target = "_blank";
    link.className = "shigureader_link";
    const encodedText = encodeURIComponent(trimmed);
    link.href = `http://localhost:${production_port}/similar-file/?text=${encodedText}`;
    fileTitleDom.append(link);
}



function addSearchLinkForEhentai() {
    //add shigureader search link
    let fileTitleDom = document.getElementById("gj");
    let title = fileTitleDom && fileTitleDom.textContent;

    if (!title) {
        fileTitleDom = document.getElementById("gn");
        title = fileTitleDom && fileTitleDom.textContent;
    }

    if (title) {
        appendSimilarLink(fileTitleDom, title);
        const r = parse(title);
        if (r) {
            if (r.author) {
                // appendLink(fileTitleDom, r.author);
            } else if (r.group) {
                // appendLink(fileTitleDom, r.group);
            }

            if (r.title) {
                // appendLink(fileTitleDom, r.title);
            }
        } else {
            // appendLink(fileTitleDom, title);
        }
    }
}

function popMessage(text){
    if(is_list_page){
        Swal.fire({
            html: text,
            timer: 1000,
            backdrop:false,
            width: "200px",
            position: 'top-end',
            // timerProgressBar: true,
            didOpen: () => {
                // Swal.showLoading()
            }
        })
    }
}

/**
 * ehentai防瞎眼
 */
function ehentaiProtection(){
    function disapprearNode(node) {
        if(node){
            // node.display = node.display || {};
            // node.display.style = "none";
            node.classList.add("disappear_dom");
            console.log("hide (transparent) one low-rating dom");
        }
    }


    let nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    nodes.forEach(node => {
        const star = node.querySelector(".ir")
        const rawPos = window.getComputedStyle(star)["backgroundPosition"];
        

        const tokens = rawPos.split(" ");
        console.assert(tokens.length == 2);
        // let pos = parseInt(tokens[1].replace("px", ""))

        const pos = tokens.map(tt => {
            return parseInt(tt.replace("px", ""));
        });

        const [x, y] = pos;

        const THRESHOLD = -48; // 2 star
        if(y == -21){
            // 0.5
             if(x <= THRESHOLD){
                disapprearNode(node)
            }
        }else{
            //整数
            if(x <= THRESHOLD){
                disapprearNode(node)
            }
        }
    })
}

const production_port = 3000;
async function main() {
    if(IS_EHENTAI){
        ehentaiProtection()
    }

    if(IS_EHENTAI){
        await highlightEhentaiThumbnail();

        if(isServerUp){
            addSearchLinkForEhentai();
        }
    }else if (IS_NYAA){
        await highlightNyaa();
    }
    if(isServerUp){
        popMessage("成功载入");
    }else{
        popMessage("无法连接到ShiguReader，无法使用搜索和高亮功能");
    }
}

main();
/******/ })()
;