// ==UserScript==
// @name			EhentaiLight配合Shigureader
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @connect     localhost
// @namespace       Aji47
// @version			0.0.1
// @description
// @author			Aji47
// @include			*://exhentai.org/*
// @include			*://g.e-hentai.org/*
// @include			*://e-hentai.org/*
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
let localCache = {};
const tempCache = localStorage.getItem("localCache");
if(tempCache){
    localCache =  JSON.parse(tempCache);
}


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
//--------------

function isSimilar(s1, s2, distance){
    distance = distance || 3;
    if(!s1 && !s2){
        return true;
    }else if(s1 && s2){
        return oneInsideOne(s1, s2) && Math.abs(s1.length - s2.length) < distance;
    }else{
        return true;
    }
}

function isSame(s1, s2){
    return s1 && s2 && s1 === s2;
}

function oneInsideOne(s1, s2){
  return s1 && s2 && (s1.includes(s2) || s2.includes(s1));
}

const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;

function checkIfDownload(text, allFileInLowerCase, authorTable){
    var status = 0;
    let similarTitle;
    text = text.toLowerCase();
    let r1 = parse(text);
    //use author as index to find
    if(r1 && r1.author){
        if(!authorTable[r1.author]){
            //totally unknown author
            return {
                status, 
                similarTitle
            };
        } else {
            status = SAME_AUTHOR;
            let breakLoop = false;
            authorTable[r1.author].forEach(e => {
                if(breakLoop){
                    return;
                }

                r1 = parse(text);
                const r2 = parse(e);
          
                const isSimilarGroup = isSimilar(r1.group, r2.group);
        
                if(isSimilarGroup){
                    if(r1.title === r2.title){
                        status = Math.max(status, IS_IN_PC);
                        breakLoop = true;
                    }else if(oneInsideOne(r1.title, r2.title)){
                        status = LIKELY_IN_PC;
                        similarTitle = e;
                    }
                }
            })
        }
    }else{
        //pure dull
        if(status < LIKELY_IN_PC){
            for (var ii = 0; ii < allFileInLowerCase.length; ii++) {
                let e = allFileInLowerCase[ii];
                if(isOnlyDigit(e)){
                    continue;
                }
    
                if(e === text){
                    status = IS_IN_PC;
                    break;
                }
          
                if(isSimilar(text, e, 8)){
                  status = Math.max(status, LIKELY_IN_PC);
                  similarTitle = e;
                }
            }
        }
    }

    return {
        status, 
        similarTitle
    }
}

const time1 = new Date().getTime();

function onLoad(dom) {
    // const time2 = new Date().getTime();
    // console.log((time2 - time1)/1000, "to load");

    localStorage.setItem('responseText',  dom.responseText);
    localStorage.setItem('lastResTime', getCurrentTime());
    const res = JSON.parse(dom.responseText);
    highlightThumbnail(res.allFiles);
}

function highlightThumbnail(allFiles){
    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    if(!nodes  || nodes.length === 0) {
        return;
    }
    const allFileInLowerCase = allFiles.map(e => e.toLowerCase());

    const authorTable = {};
    allFileInLowerCase.forEach(e => {
        const r =  parse(e);
        if(r && r.author){
            authorTable[r.author] = authorTable[r.author]||[];
            authorTable[r.author].push(e);
        }
    });

    localStorage.setItem("localCache", JSON.stringify(localCache));

    // const time25 = new Date().getTime();
    // console.log((time25 - time2)/1000, "to parse name");

    nodes.forEach(e => {
        try{
            const subNode = e.getElementsByClassName("gl4t")[0];
            const thumbnailNode = e.getElementsByTagName("img")[0];
            const text = subNode.textContent;
            e.status = 0;
            if(text.includes("翻訳") || text.includes("翻译")){
                return;
            }
            const r =  parse(text);
            const {status, similarTitle} = checkIfDownload(text, allFileInLowerCase, authorTable);
            e.status = status || 0;
            if(status === IS_IN_PC){
                subNode.style.color =  "#61ef47"; //"green";
                thumbnailNode.title = "明确已经下载过了";
            } else if(status === LIKELY_IN_PC){
                subNode.style.color = "#efd41b"; //"yellow";
                thumbnailNode.title = `电脑里的“${similarTitle}”和这本好像一样`;
                e.style.background = "#212121";
            }else if(status === SAME_AUTHOR){
                subNode.style.color = "#ef8787"; // "red";
                let authortimes = authorTable[r.author.toLowerCase()].length; 
                thumbnailNode.title = `下载同样作者“${r.author}”的书 ${authortimes}次`;
                e.style.background = "#111111"
            }
            if(status){
                subNode.style.fontWeight = 600;
            }
        }catch(e){
            console.error(e);
        }
    });

    //sort by its status
    //and replace the orginal nodes
    nodes.sort((a, b) =>{return  b.status - a.status;})
    const parentRoot = nodes[0].parentElement;
    parentRoot.innerHTML = '';
    nodes.forEach(e => parentRoot.appendChild(e));

    // const time3 = new Date().getTime();
    // console.log((time3 - time25)/1000, "to change dom");
}

function appendLink(fileTitleDom, text){
    var link = document.createElement("a");
    link.textContent = `Search ${text} in ShiguReader`;
    link.style.display = "block";
    fileTitleDom.append(link);
    link.target = "_blank"
    link.className ="shigureader_link";
    link.href = "http://localhost:3000/search/" + text;
}

function getCurrentTime(){
    return new Date().getTime();
}

function onTimeout(){
    const responseText = localStorage.getItem('responseText');
    if(responseText){
        const res = JSON.parse(responseText);
        highlightThumbnail(res.allFiles);
    }
}

function main() {
    const responseText = localStorage.getItem('responseText');
    const lastResTime = localStorage.getItem('lastResTime');
    const EXPIRE_TIME = 1000*60*2;
    if(responseText && lastResTime && ( getCurrentTime() - (+lastResTime) < EXPIRE_TIME )){
        const res = JSON.parse(responseText);
        highlightThumbnail(res.allFiles);
    }else{
          //annote file table
        var api = 'http://localhost:8080/api/exhentaiApi';
        GM_xmlhttpRequest({
            method: "GET",
            url:api,
            onload: onLoad,
            onerror: onTimeout,
            ontimeout: onTimeout
        });
    }

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

            if(r.title){
               appendLink(fileTitleDom, r.title);
            }
        } else {
            appendLink(fileTitleDom, title);
        }
    }
}

// .shigureader_link {
//     font-size: 12px;
//     text-decoration:none;
//     &:hover{
//         color: #b0f3ff
//     }
// }
GM_addStyle(".shigureader_link {   font-size: 12px;   text-decoration: none;} .shigureader_link:hover {    color: #b0f3ff;} ");

// [title]:hover:after{
//     content: attr(title);
//     background:white;
//     color: rgb(27, 25, 25);
//     font-size: 20px;
//     padding: 5px;
//     border-radius:5px;
//     border:1px solid;
//     z-index: 100;
//   }

main();