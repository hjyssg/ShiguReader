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
    "Pixiv",
    "アーティスト",
    "雑誌",
    "English",
    "320K"
]

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
            const nextCharIndex = str.indexOf(bMacthes[ii]) + bMacthes[ii].length + 1; 
            const nextChar = str[nextCharIndex];

            if (token.length === 6 && isOnlyDigit(token) && isStrDate(token)) {
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

    tags = tags.concat(getTag(str, pMacthes, author));
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

    const authors = author && author.includes("、")? author.split("、") : null;

    const result = {
       dateTag, author, tags, comiket, type, group, title, authors
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

                //e.g one is c97, the other is c96. cannot be the same 
                if(r1.comiket && r2.comiket && r1.comiket !== r2.comiket ){
                    return;
                }
        
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
                // e.style.background = "#212121";
            }else if(status === SAME_AUTHOR){
                subNode.style.color = "#ef8787"; // "red";
                let authortimes = authorTable[r.author.toLowerCase()].length; 
                thumbnailNode.title = `下载同样作者“${r.author}”的书 ${authortimes}次`;
                // e.style.background = "#111111"
            }
            if(status){
                subNode.style.fontWeight = 600;
            }
        }catch(e){
            console.error(e);
        }
    });

    //only sort the home page
    if(window.location.pathname === "/"){
        //sort by its status
        //and replace the orginal nodes
        nodes.sort((a, b) =>{return  b.status - a.status;})
        const parentRoot = nodes[0].parentElement;
        parentRoot.innerHTML = '';
        nodes.forEach(e => parentRoot.appendChild(e));
    }
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
    link.href = "http://localhost:3000/search/?s=" + text;
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