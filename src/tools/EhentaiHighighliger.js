// ==UserScript==
// @name        EhentaiLight配合Shigureader
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @connect     localhost
// @namespace       Aji47
// @version         0.0.1
// @description
// @author        Aji47
// @include       *://exhentai.org/*
// @include       *://g.e-hentai.org/*
// @include       *://e-hentai.org/*
// @require      https://raw.githubusercontent.com/hjyssg/ShiguReader/edit_distance/src/name-parser/all_in_one/index.js
// @require https://cdnjs.cloudflare.com/ajax/libs/lokijs/1.5.11/lokijs.min.js
// ==/UserScript==

console.assert = console.assert || (() => {});

//-------------------------------
function oneInsideOne(s1, s2){
    return s1 && s2 && (s1.includes(s2) || s2.includes(s1));
}

const puReg = /[ \.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋￥：？]/g
function _clean(str){
    return str && str.replaceAll(puReg, "");
}

console.assert(_clean("和泉、れいぜい") === _clean("和泉, れいぜい"))

const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;
const TOTALLY_DIFFERENT = 0;

function isTwoBookTheSame(fn1, fn2){
    fn1 = fn1.toLowerCase();
    fn2 = fn2.toLowerCase();

    const r1 = parse(fn1);
    const r2 = parse(fn2);

    if(_clean(r1.author) !== _clean(r2.author)){
        return TOTALLY_DIFFERENT;
    }

    let result = SAME_AUTHOR;
    //e.g one is c97, the other is c96. cannot be the same 
    if(r1.comiket && r2.comiket && r1.comiket !== r2.comiket ){
        return result;
    }

    let isSimilarGroup;
    let group1 = _clean(r1.group);
    let group2 = _clean(r2.group);
    if((group1 && !group2) || (!group1 && group2)){
        isSimilarGroup = true;
    }else{
        isSimilarGroup = isSimilar(group1, group2);
    }

    if(isSimilarGroup){
        let title1 = _clean(r1.title);
        let title2 = _clean(r2.title);
        if(title1 === title2 || isSimilar(title1, title2)){
            result = IS_IN_PC;
        }else if(oneInsideOne(title1, title2)){
            result = LIKELY_IN_PC;
        }
    }
    return result;
}

//------------------------------------------------------

function checkIfDownload(text, allFileInLowerCase, authorTable){
    var status = 0;
    let similarTitle;
    text = text.toLowerCase();
    let r1 = parse(text);
    if(r1 && r1.author){
        //use author as index to find
        let books = authorTable.get(r1.author);
        if(books){
            status = SAME_AUTHOR;
            for(let ii = 0; ii < books.length; ii++){
                let fn2 =  books[ii];
                status = Math.max(status, isTwoBookTheSame(text, fn2));
                if(status === LIKELY_IN_PC){
                    similarTitle = fn2;
                }
    
                if(status === IS_IN_PC){
                    break;
                }
            }
        }
    }else{
        //pure dumm iteration, brute force search
        text = _clean(text);
        for (var ii = 0; ii < allFileInLowerCase.length; ii++) {
            let e = _clean(allFileInLowerCase[ii]);
            if(isOnlyDigit(e)){
                continue;
            }

            if(e === text){
                status = IS_IN_PC;
                break;
            }
        
            if(status < LIKELY_IN_PC && isSimilar(text, e)){
                status = Math.max(status, LIKELY_IN_PC);
                similarTitle = e;
            }
        }
    }

    return {
        status, 
        similarTitle
    }
}

function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}


//--------------------------------------------------------------

const time1 = new Date().getTime();

function onLoad(dom) {
    // const time2 = new Date().getTime();
    // console.log((time2 - time1)/1000, "to load");

    GM_setValue('responseText',  dom.responseText);
    GM_setValue('lastResTime', getCurrentTime());
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
    authorTable.get = key => {
        key = _clean(key);
        return authorTable[key];
    }

    authorTable.push = (key, value) => {
        key = _clean(key);
        authorTable[key] = authorTable[key] || [];
        authorTable[key].push(value);
    }

    allFileInLowerCase.forEach(e => {
        const r =  parse(e);
        if(r && r.author){
            authorTable.push(r.author, e);
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
                let authortimes = authorTable.get(r.author.toLowerCase()).length; 
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
    const responseText = GM_getValue('responseText');
    if(responseText){
        const res = JSON.parse(responseText);
        highlightThumbnail(res.allFiles);
    }
}

function main() {
    const responseText = GM_getValue('responseText');
    const lastResTime = GM_getValue('lastResTime');
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