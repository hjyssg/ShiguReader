// ==UserScript==
// @name			EhentaiLight配合Shigureader
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// @connect     localhost
// @namespace       Aji47
// @version			0.0.1
// @description
// @author			Aji47
// @include			*://exhentai.org/*
// @include			*://g.e-hentai.org/*
// ==/UserScript==

//用于tempermonkey

//----------------from nameParser/singleFileVersion
const same_tags = [
    ["艦これ","艦隊これくしょん", "艦隊これくしょん-艦これ-", "艦隊これくしょん -艦これ-","艦隊これくしょん -艦これ", "Kantai Collection -KanColle-", "Kantai Collection"],
    ["ラブライブ!","ラブライブ! School idol project","ラブライブ"],
    ["ラブライブ!サンシャイン!!", "ブライブ！ サンシャイン!!"],
    ["Fate⁄Grand Order", "Fate／Grand Order", "FateGrand Order", "Fate Grand Order", "FGO"],
    ["オリジナル", "Original"],
    ["東方Projec","東方"],
    ["アイドルマスター", "アイマス", "THE iDOLM@STER"],
];

const not_author_but_tag = [
    "同人音声",
    "アンソロジー",
    "DL版",
    "よろず",
    "成年コミック",
    "Pixiv"
]

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

same_tags.forEach(row => {
    for(let ii = 1; ii < row.length; ii++){
        convertTable[row[ii]] = row[0];
    }
});


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
        if(ALL_COMIC_TAGS.includes(e)){
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


    let title = str;
    (bMacthes||[]).concat(pMacthes||[]).concat([/\[/g, /\]/g, /\(/g, /\)/g ]).forEach(e => {
        title = title.replace(e, "");
    })

    if(!author && !group){
        return;
    }

    const result = {
        author, tags, comiket, type, group, title
    };

    localCache[str] = result;
    return result;
}
//--------------

function checkIfDownload(text, allFiles){
    var status = 0;
    for (var ii = 0; ii < allFiles.length; ii++) {
      const e = allFiles[ii];
      if(e === text){
         status = IS_IN_PC;
         break;
      }else{
        const r1 = parse(text);
        const r2 = parse(e);

        if(r1 && r2){
            if( (r1.author && r2.author && r1.author === r2.author) || 
                (r1.group && r2.group && r1.group === r2.group)){
                status =  SAME_AUTHOR;
                if(r1.title === r2.title){
                    status = IS_IN_PC;
                    break;
                }else if(r1.title.includes(r2.title) || r2.title.includes(r1.title)){
                    status = LIKELY_IN_PC;
                }
            }
        }
      }
    };
    return status;
}



const IS_IN_PC = "in_pc";
const LIKELY_IN_PC = "likely_in_pc";
const SAME_AUTHOR = "from same_author"

function onLoad(dom) {
    const res = JSON.parse(dom.responseText);
    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl4t glname glink"));

    const {allFiles, goodAuthors, otherAuthors } =  res;

    nodes.forEach(e => {
          const text = e.textContent;
          const r =  parse(text);
          const status = checkIfDownload(text, allFiles);
          if(status === IS_IN_PC){
            e.style.color = "green";
            e.title = "明确已经下载过了";
          } else if(status === LIKELY_IN_PC){
            e.style.color = "yellow";
            e.title = "可能下载过了";
          }else if(status === SAME_AUTHOR){
            e.style.color = "red";
            e.title = "下载同样作者的书";
          }
    });
}

function appendLink(fileTitleDom, text){
    var link = document.createElement("a");
    link.textContent = `Search ${text} in ShiguReader`;
    link.style.display = "block";
    fileTitleDom.append(link);
    link.href = "http://localhost:3000/search/" + text;
}

  
function main() {
    //annote file table
    var api = 'http://localhost:8080/api/exhentaiApi';
    GM_xmlhttpRequest({
        method: "GET",
        url:api,
        onload: onLoad
    });

    //add shigureader search link  
    let fileTitleDom = document.getElementById("gj");
    let title = fileTitleDom && fileTitleDom.textContent;

    if(!title){
        fileTitleDom = document.getElementById("gn");
        title = fileTitleDom && fileTitleDom.textContent;
    }

    if(title){
        const r = parse(title);
        if(r){
            if(r.author){
                appendLink(fileTitleDom, r.author);
            }else if(r.group){
                appendLink(fileTitleDom, r.group);
            }
        }else{
            appendLink(fileTitleDom, title);
        }
    }
  }
  
  main()