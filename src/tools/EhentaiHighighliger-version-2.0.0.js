// ==UserScript==
// @name        EhentaiLight配合Everything
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
// @connect     localhost
// @namespace       Aji47
// @version         2.0.0
// @description
// @author        Aji47
// @include       *://exhentai.org/*
// @include       *://g.e-hentai.org/*
// @include       *://e-hentai.org/*
// @require      https://raw.githubusercontent.com/hjyssg/ShiguReader/dev/src/name-parser/all_in_one/index.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lokijs/1.5.11/lokijs.min.js
// ==/UserScript==

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

`);



console.assert = console.assert || (() => { });

//-------------------------------
function oneInsideOne(s1, s2) {
    return s1 && s2 && (s1.includes(s2) || s2.includes(s1));
}

const puReg = /[ \.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋￥：？]/g
function _clean(str) {
    return str && str.replaceAll(puReg, "");
}

console.assert(_clean("和泉、れいぜい") === _clean("和泉, れいぜい"))

const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;
const TOTALLY_DIFFERENT = 0;

function isTwoBookTheSame(fn1, fn2) {
    fn1 = fn1.toLowerCase();
    fn2 = fn2.toLowerCase();

    const r1 = parse(fn1);
    const r2 = parse(fn2);

    if (_clean(r1.author) !== _clean(r2.author)) {
        return TOTALLY_DIFFERENT;
    }

    let result = SAME_AUTHOR;
    //e.g one is c97, the other is c96. cannot be the same
    if (r1.comiket && r2.comiket && r1.comiket !== r2.comiket) {
        return result;
    }

    let isSimilarGroup;
    let group1 = _clean(r1.group);
    let group2 = _clean(r2.group);
    if ((group1 && !group2) || (!group1 && group2)) {
        isSimilarGroup = true;
    } else {
        isSimilarGroup = isHighlySimilar(group1, group2);
    }

    if (isSimilarGroup) {
        let title1 = _clean(r1.title);
        let title2 = _clean(r2.title);
        if (title1 === title2 || isHighlySimilar(title1, title2)) {
            result = IS_IN_PC;
        } else if (oneInsideOne(title1, title2)) {
            result = LIKELY_IN_PC;
        }
    }
    return result;
}

//------------------------------------------------------
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

//------

function checkIfDownload(text, books) {
    var status = 0;
    let similarTitles = [];
    let r1 = parse(text);

    if (r1 && r1.author) {
        //use author as index to find

        if (books && books.length > 0) {
            status = SAME_AUTHOR;
            for (let ii = 0; ii < books.length; ii++) {
                const fn2 = books[ii];
                const r2 = parse(fn2)

                if (!compareInternalDigit(r1.title, r2.title)) {
                    continue;
                }

                status = Math.max(status, isTwoBookTheSame(text, fn2));
                if (status === LIKELY_IN_PC) {
                    similarTitles.push(fn2);
                    //todo pick the most similar 
                    //or show all
                }

                if (status === IS_IN_PC) {
                    break;
                }
            }
        }
    } else {
        books.forEach(e => {
            if (e === text) {
                status = IS_IN_PC;
            }

            if (status < LIKELY_IN_PC && isHighlySimilar(e, text)) {
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

function isOnlyDigit(str) {
    return str.match(/^[0-9]+$/) != null
}

const compressTypes = [".zip", ".rar", ".7zip", ".7z", ".gzip", ".tar"];
function escapeDot(arr) {
    return arr.map(e => e.replace(".", "\\."))
}
const compressTypesRegex = new RegExp("(" + escapeDot(compressTypes).join("|") + ")$");
const isCompress = function (fn) {
    return !!fn.toLowerCase().match(compressTypesRegex);
};

//--------------------------------------------------------------
function getCurrentTime() {
    return new Date().getTime();
}

const begTime = getCurrentTime();
let time2;
const file_db = new loki();
const file_collection = file_db.addCollection("file_collection");

async function highlightThumbnail() {
    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    if (!nodes || nodes.length === 0) {
        return;
    }

    const timeMiddle2 = getCurrentTime();
    console.log((timeMiddle2 - time2) / 1000, "to parse name");

    for (let index = 0; index < nodes.length; index++) {
        const e = nodes[index];
        try {
            const subNode = e.getElementsByClassName("gl4t")[0];
            const thumbnailNode = e.getElementsByTagName("img")[0];
            let text = subNode.textContent;

            if (text.includes("翻訳") || text.includes("翻译")) {
                return;
            }

            let r1 = parse(text);

            let _text = text;
            if(r1){
                if(r1.author){
                    _text = r1.author;
                }else if(r1.title){
                    _text = r1.title;
                }
            }
            const tt = encodeURIComponent(_text);
            const uri = `http://localhost:5001/?search="${tt}"&offset=0&json=1&path_column=1&size_column=1&date_modified_column=1`;
            let res = await GM_xmlhttpRequest_promise("GET", uri);

            res = JSON.parse(res.responseText)
            const books_info = res.results;

            const books = books_info.filter(e => e.type === "file" && isCompress(e.name)).map(e => e.name)
            e.status = 0;
            
            const { status, similarTitles } = checkIfDownload(text, books);

            e.status = status || 0;
            if (status === IS_IN_PC) {
                subNode.style.color = "#61ef47";
                addTooltip(thumbnailNode, "明确已经下载过了", similarTitles)
            } else if (status === LIKELY_IN_PC) {
                subNode.style.color = "#efd41b";
                addTooltip(thumbnailNode, "电脑里面好像有", similarTitles)
            } else if (status === SAME_AUTHOR) {
                subNode.style.color = "#ef8787";
                addTooltip(thumbnailNode, `下载同样作者“${r1.author}”的书 ${books.length}次`, books, "same_author")
            }

            if (status) {
                if (r1) {
                    appendLink(e, r1.author);
                    // if (status >= LIKELY_IN_PC) {
                    //     appendLink(e, r1.title);
                    // }
                } else {
                    appendLink(e, text);
                }

                subNode.style.fontWeight = 600;
            }
        } catch (e) {
            console.error(e);
        }
        
    }


    const finishTime = getCurrentTime();
    console.log((finishTime - timeMiddle2) / 1000, "to finish algo and change dom");

    console.log((finishTime - begTime) / 1000, "for any time");
}

function addTooltip(node, title, books, same_author) {
    books.sort();
    //indent
    books = books.map((e, ii) => {
        let tt = ii + 1;
        if (tt < 10) {
            tt = "0" + tt;
        }
        const t1 = "  " + tt + ".  ";
        return t1 + e;

        // if(same_author){
        //     const pObj = parse(e);
        //     return t1 + (pObj.comiket||"") + pObj.title + "(" + pObj.tags + ")";
        // }else{
        // }
    });
    if (books.length > 25) {
        books = books.slice(0, 10).concat("...");
    }
    node.title = [title, "  ",].concat(books).join("\n");;
}

function appendLink(fileTitleDom, text, asIcon) {
    var link = document.createElement("a");

    if (asIcon) {
        link.textContent = "🔍";
    } else {
        link.textContent = `Search ${text} in ShiguReader`;
    }

    link.style.display = "block";
    fileTitleDom.append(link);
    link.target = "_blank"
    link.className = "shigureader_link";
    link.href = "http://localhost:3000/search/?s=" + text;
}




function GM_xmlhttpRequest_promise(method, api, data) {
    //tamper monkey have bug
    //timeout do not work
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: method,
            url: api,
            data: data,
            headers:    {
                "Content-Type": "application/json"
            },
            onload: res => {
                resolve(res);
            },
            onTimeout: () => {
                resolve();
            },
            onerror: () => {
                resolve();
            }
        });
    })
}

function addSearchLink() {
    //add shigureader search link
    let fileTitleDom = document.getElementById("gj");
    let title = fileTitleDom && fileTitleDom.textContent;

    if (!title) {
        fileTitleDom = document.getElementById("gn");
        title = fileTitleDom && fileTitleDom.textContent;
    }

    if (title) {
        const r = parse(title);
        if (r) {
            if (r.author) {
                appendLink(fileTitleDom, r.author);
            } else if (r.group) {
                appendLink(fileTitleDom, r.group);
            }

            if (r.title) {
                appendLink(fileTitleDom, r.title);
            }
        } else {
            appendLink(fileTitleDom, title);
        }
    }
}


async function main() {
    addSearchLink();
    //annote file table

    await highlightThumbnail();
}


main();