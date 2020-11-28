const same_tag_regs_table = {
    "東方Project":[/^東方$/,/Touhou\s*Project/, /東方project/],
    "オリジナル": [/^Original$/],
    "Kanon": [/カノン|Kanon/],
    "艦これ": [/艦これ|舰これ/, /艦隊これくしょん/, /Kantai\s*Collection/, /KanColle/],
    "ラブライブ!" : [/Love Live/, /ラブライブ/],
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
    "ガンダム ":[/ガンダム|gundam/],
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
    "To Heart 2":[/To.*Heart.*2|トゥハート2/]
}

const not_author_but_tag = [
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

const char_names = [
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
//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
const char_name_regex = new RegExp(char_names.join("|"));
const not_author_but_tag_regex =  new RegExp(not_author_but_tag.join("|"), "i");

const book_types = [
    "同人音声",
    "同人催眠音声",
    "同人ソフト",
    "同人CG集",
    "同人ゲーム",
    "成年コミック",
    "一般コミック",
    "ゲームCG",
    "イラスト集",
    "アンソロジー",
    "画集",
    "雑誌"
];
const book_type_regex = new RegExp(book_types.map(e => `(${e})`).join("|"), "i");

function isBookType(str){
    return !!str.match(book_type_regex);
}

function getBookType(str){
    return str.match(book_type_regex)[0];
}

const same_tag_matrix = [];
for(let tag in same_tag_regs_table){
    if(same_tag_regs_table.hasOwnProperty(tag)){
        const big_pre_join = same_tag_regs_table[tag].map(e =>e.source)
        const r =  new RegExp(big_pre_join.join("|"), 'i')
        const row = [r, tag];
        same_tag_matrix.push(row);
    }
}
same_tag_matrix.sort((r1, r2) => {
    return r2[1].length - r1[1].length
});

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
                /ファータグランデ騎空祭/, /歌姫庭園/, /紅楼夢/, 
                /CSP\d/, /CC大阪\d/, /COMITIA\d/];

const event_reg = new RegExp(reg_list.map(e => e.source).join("|"), "i");

function belongToEvent(e){
    return e.match(event_reg);
}


const comiket_to_date_table = {};
function getDateFromParse(str){
    const pp = parse(str);
    let result;
    if(pp){
        if(pp.dateTag){
            result = getDateFromStr(pp.dateTag);
        }else if(pp.comiket){
            result = getDateFromComiket(pp.comiket)
        }
    }
    return result;
}

//for sort algo, not very accurate
function getDateFromComiket(comiket){
    let result = null;
    let num;
    let year;
    let month;
    
    if (comiket_to_date_table[comiket]) {
        result = comiket_to_date_table[comiket];
    } else if(comiket.match(comicket_reg)) {
        comiket = comiket.replace("C", "");
        num = parseInt(comiket);
        year = Math.floor(num /2) + 1971;
        const isSummer = num % 2 === 0;
        month = isSummer? 8 : 11;
        const day = isSummer? 10: 28;
        result = new Date(year, month, day);
    } else if(comiket.match(comic_star_reg)) {
        comiket = comiket.replace("COMIC1☆", "");
        num = parseInt(comiket);
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
        comiket_to_date_table[comiket] = result;
    }
    return result;
}

function getDateFromStr(str){
    const mresult =  str.match(date_reg);
    if(mresult){
        let [wm, y, m, d] = mresult.filter(e => !!e);
        y = convertYearString(y);
        m = parseInt(m)-1;
        d = parseInt(d)||1;

        if(m < 0 || m > 11){
            return undefined;
        }else if(d < 1 || d > 31){
            return undefined;
        }

        return new Date(y, m, d);
    }
}

function convertYearString(y) {
    if(y.length === 2){
        y =  parseInt(y);
        if (y > 70) {
            y = 1900 + y;
        }else {
            y = 2000 + y;
        }
    }else{
        y =  parseInt(y)
    }

    return y;
}


function isDateValid(date) {
    // An invalid date object returns NaN for getTime() and NaN is the only
    // object not strictly equal to itself.
    return date.getTime() === date.getTime();
};  

const dreg1 = /(\d{2})(\d{2})(\d{2})/;
const dreg2 = /(\d{2})-(\d{2})-(\d{2})/;
const dreg3 = /(\d{4})-(\d{1,2})-(\d{2})/;
const dreg4 = /(\d{4})年(\d{1,2})月号/;
const dreg5 = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
const dreg6 = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
const date_reg = new RegExp([dreg1, dreg2, dreg3, dreg4, dreg5, dreg6].map(e => e.source).join("|"), "i");
function isStrDate(str) {
    if(str.match(date_reg)){
        const dd = getDateFromStr(str);
        return !!(dd && isDateValid(dd));
    }
}


function getGroupAndName(str){
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

const useless_tag = /RJ\d+|DL版|別スキャン^エロ|^digital$|^\d+p|^\d+$/i;
function isUselessTag(str){
    return !!str.match(useless_tag)
}

function findMaxStr(arr){
    let res = arr[0];
    arr.forEach(e => {
        if(e.length > res.length){
            res = e;
        }
    })
    return res;
}

const pReg = /\((.*?)\)/g;
const bReg = /\[(.*?)\]/g;
const seperator = /,|、|&|＆/;

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
    let authors = [];
    let group;
    let dateTag;
    let comiket;
    let type;
    let tags = [];

    function isOtherInfo(token){
        let result = false;
        if(isBookType(token)){
            type = getBookType(token);
            result = true;
        }else if(isUselessTag(token)){
            //nothing
            result = true;
        } else if(belongToEvent(token)){
            comiket = token;
            result = true;
        }else if (isStrDate(token)) {
            dateTag = token;  //e.g 190214
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

            if(isOtherInfo(token)){
                continue;
            }  if (isNotAuthor(tt)){
                //e.g pixiv is not author
                tags.push(token);
            } else if (nextChar === "." || nextCharIndex >= str.length){
                //e.g KI-RecenT SP02 NATURALCORDE [DL版].zip
                // [DL版] is not auhor name
                tags.push(token);
            } else if(!author) {
                //  [真珠貝(武田弘光)]
                const temp = getGroupAndName(token);
                if(temp.name && !isNotAuthor(temp.name)){
                    //e.g よろず is not author
                    author = temp.name;
                    authors = author.split(seperator).map(e => e.trim()) ;
                }
                group = temp.group;
            }else{
                tags.push(token);
            }
        }
    }

    //---------------handle tags
    if (pMacthes && pMacthes.length > 0) {
        tags = tags.concat(pMacthes);
    }

    //seperate
    const tseperator = /,|、/;
    const tempTags = [];
    tags.forEach(t => {
        t.split(tseperator).forEach(token => {
            tempTags.push(token);
        })
    })
    tags = tempTags;

    tags = tags.map(e => e.trim());

    tags = tags.filter(e=> {
        return  e.length > 1 && !isOtherInfo(e) && authors.indexOf(e) === -1 && e !== author;
    });

    tags = tags
    .map(e => e.replace(/ |。/g, "").replace(/！/g, "!").replace(/？/g, "?"))

    //tag reducing
    tags = tags.map(e => {
        const converts = [];
        for(let ii = 0; ii < same_tag_matrix.length; ii++){
            const row = same_tag_matrix[ii];
            const r = row[0];
            if(e.match(r)){
                converts.push(row[1]);
            }
        }

        if(converts.length > 0){
            return findMaxStr(converts);
        }else{
            return e;
        }
    })

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

    //get title
    let title = str;
    (bMacthes||[]).concat( pMacthes||[], tags||[], [/\[/g, /\]/g, /\(/g, /\)/g ]).forEach(e => {
        title = title.replace(e, "");
    })
    title = title.trim();

    //get character names
    const names = char_name_regex && title.match(char_name_regex);
    names && names.forEach(e => {
        tags.push(e);
    })

    const result = {
       dateTag, group, author, authors, tags, comiket, type, title
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

console.assert(editDistance("abc", "b") === 2)
console.assert(editDistance("tozanbu", "tozan:bu") === 1)
console.assert(editDistance("tozan；bu", "tozan:bu") === 1)
//---------------------

function isSimilar(s1, s2){
    if(!s1 && !s2){
        return true;
    }else if(s1 && s2){
        const distance = editDistance(s1, s2);
        const avgLen = (s1.length + s2.length)/2;
        const ratio = distance/(Math.ceil(avgLen));
        return ratio <= 0.2;
    }else{
        return false;
    }
}

console.assert(isSimilar("tozanbu", "tozan:bu"))
console.assert(isSimilar("tobu", "to:bu"))
console.assert(isSimilar("12ab", "12abc")) 

console.assert(isSimilar("時雨露出×野外2", "白露型時雨露出×野外2") === false) ;
console.assert(isSimilar("12a", "13a") === false) 
console.assert(isSimilar("12", "ab") === false)


