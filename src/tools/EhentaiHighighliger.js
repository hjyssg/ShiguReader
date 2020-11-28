// ==UserScript==
// @name        EhentaiLight配合Shigureader
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
// @connect     localhost
// @namespace       Aji47
// @version         0.0.21
// @description
// @author        Aji47
// @include       *://exhentai.org/*
// @include       *://g.e-hentai.org/*
// @include       *://e-hentai.org/*
// @require      https://raw.githubusercontent.com/hjyssg/ShiguReader/dev/src/name-parser/all_in_one/index.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lokijs/1.5.11/lokijs.min.js
// ==/UserScript==

//tamper monkey自动缓存require脚本，随便改一下版本号就可以更新

GM_addStyle (`
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

`);



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
        isSimilarGroup = isHighlySimilar(group1, group2);
    }

    if(isSimilarGroup){
        let title1 = _clean(r1.title);
        let title2 = _clean(r2.title);
        if(title1 === title2 || isHighlySimilar(title1, title2)){
            result = IS_IN_PC;
        }else if(oneInsideOne(title1, title2)){
            result = LIKELY_IN_PC;
        }
    }
    return result;
}

//------------------------------------------------------
function compareInternalDigit(s1, s2){
    const digitTokens1 = s1.match(/\d+/g);
    const digitTokens2 = s2.match(/\d+/g);
    if(digitTokens1 && digitTokens2){
        if(digitTokens1.length !== digitTokens2.length || 
            digitTokens1.join() !== digitTokens2.join()){
            return false;
        }
    }else if(digitTokens1 && !digitTokens2){
        return false;
    }else if(!digitTokens1 && digitTokens2){
        return false;
    }
    return true;
}

//------

function checkIfDownload(text, pageNum){
    var status = 0;
    let similarTitles = [];
    let r1 = parse(text);

    function comparePageNum(book, pageNum){
        if(!isNaN(book.pageNum) && Math.abs(book.pageNum - pageNum) >= 5){
            return true;
        }
        return false;
    }

    if(r1 && r1.author){
        //use author as index to find
        let books = getByAuthor(r1.author);

        if(books && books.length > 0){
            status = SAME_AUTHOR;
            for(let ii = 0; ii < books.length; ii++){
                const book = books[ii];
                if(comparePageNum(book, pageNum)){
                    continue;
                }

                let fn2 =  book.fileName;
                const r2 = parse(fn2)

                if(!compareInternalDigit(r1.title, r2.title)){
                    continue;
                }

                status = Math.max(status, isTwoBookTheSame(text, fn2));
                if(status === LIKELY_IN_PC){
                    similarTitles.push(fn2);
                    //todo pick the most similar 
                    //or show all
                }

                if(status === IS_IN_PC){
                    break;
                }
            }
        }
    }else{
        const _text = _clean(text);
        let reg = escapeRegExp(_text);
        let books =  file_collection.chain()
            .find({'_filename_': { '$regex' : reg }})
            .data();

        books.forEach(e => {
            if(comparePageNum(e, pageNum)){
                return;
            }

            if(e._filename_ === _text){
                status = IS_IN_PC;
            }

            if(status < LIKELY_IN_PC && isHighlySimilar(e._filename_, _text)){
                status = Math.max(status, LIKELY_IN_PC);
                similarTitles.push(e);
            }
        })
    }

    return {
        status,
        similarTitles
    }
}

function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}


//--------------------------------------------------------------

const begTime = new Date().getTime();
let time2;

function onLoad(dom) {
    time2 = new Date().getTime();
    console.log((time2 - begTime)/1000, "to load");
    GM_setValue('responseText',  dom.responseText);
    GM_setValue('lastResTime', getCurrentTime());
    const res = JSON.parse(dom.responseText);
    highlightThumbnail(res.allFiles);
}

const file_db = new loki();
const file_collection = file_db.addCollection("file_collection");

escapeRegExp = function(string) {
    const str = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    var reg = new RegExp(str, 'i');
    return reg;
}

function getByAuthor(key){
    key = _clean(key);
    let reg = escapeRegExp(key);
    return file_collection.chain()
        .find({'_author_': { '$regex' : reg }})
        .where(obj => {
            return isHighlySimilar(obj['_author_'], key);
        })
        .data();
}

function highlightThumbnail(allFiles){
    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    if(!nodes  || nodes.length === 0) {
        return;
    }


    for(let e in allFiles){
        if (allFiles.hasOwnProperty(e)){
            const r =  parse(e) || {};
            const value = allFiles[e];
            file_collection.insert({
                fileName: e,
                _author_: _clean(r.author),
                _filename_: _clean(e),
                title: r.title,
                pageNum: parseInt(value.pageNum)
            })
        }
    }

    const timeMiddle2 = new Date().getTime();
    console.log((timeMiddle2 - time2)/1000, "to parse name");

    nodes.forEach(e => {
        try{
            const subNode = e.getElementsByClassName("gl4t")[0];
            const thumbnailNode = e.getElementsByTagName("img")[0];
            const text = subNode.textContent;

            const pageNumDiv = e.querySelector(".gl5t").children[1].children[1];
            const pageNum =parseInt(pageNumDiv.textContent.split(" ")[0]);

            e.status = 0;
            if(text.includes("翻訳") || text.includes("翻译")){
                return;
            }
            const r =  parse(text);
            const {status, similarTitles} = checkIfDownload(text, pageNum);
            e.status = status || 0;
            if(status === IS_IN_PC){
                subNode.style.color =  "#61ef47"; 
                thumbnailNode.title =  "明确已经下载过了";
            } else if(status === LIKELY_IN_PC){
                subNode.style.color = "#efd41b";
                thumbnailNode.title = "电脑里面好像有";
            }else if(status === SAME_AUTHOR){
                subNode.style.color = "#ef8787"; 
                const fns = getByAuthor(r.author).map(e => e.fileName);
                thumbnailNode.title = `下载同样作者“${r.author}”的书 ${fns.length}次`
            }

            if(status){
                if(r){
                    appendLink(e, r.author);
                    if(status >= LIKELY_IN_PC){
                        appendLink(e, r.title);
                    }
                }else{
                    appendLink(e, text);
                }

                subNode.style.fontWeight = 600;
            }
        }catch(e){
            console.error(e);
        }
    });

    const finishTime = new Date().getTime();
    console.log((finishTime - timeMiddle2)/1000, "to finish algo and change dom");

    console.log((finishTime - begTime)/1000, "for any time");
}

function appendLink(fileTitleDom, text, asIcon){
    var link = document.createElement("a");

    if(asIcon){
        link.textContent = "🔍";
    }else{
        link.textContent = `Search ${text} in ShiguReader`;
    }

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
        time2 = new Date().getTime();
        console.log((time2 - begTime)/1000, "to load");
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


main();