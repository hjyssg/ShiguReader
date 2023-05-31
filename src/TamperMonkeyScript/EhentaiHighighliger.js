// ==UserScript==
// @name        EhentaiLight配合Shigureader
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
// @connect     localhost
// @namespace       Aji47
// @version         0.0.29
// @description
// @author        Aji47
// @include       *://exhentai.org/*
// @include       *://g.e-hentai.org/*
// @include       *://e-hentai.org/*
// @include       *://sukebei.nyaa.si/*
// @include       *://sukebei.nyaa.si
// @require      https://raw.githubusercontent.com/hjyssg/ShiguReader/dev/src/name-parser/all_in_one/index.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lokijs/1.5.11/lokijs.min.js
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11.7.5/dist/sweetalert2.all.min.js
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

.disappear_dom {
    display: none !important;
}

`);

const IS_EHENTAI = window.location.hostname.includes("exhentai") || window.location.hostname.includes("e-hentai");
const IS_NYAA =  window.location.hostname.includes("nyaa");

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

function checkIfDownload(text, pageNum) {
    var status = 0;
    let similarTitles = [];
    let r1 = parse(text);

    function isPageNumDifferent(book, pageNum) {
        //pageNum没啥用，还占用后端大量计算资源        
        if(!pageNum){
            return false;
        }
        if (!IS_EHENTAI){
            return false;
        }
        if (!isNaN(book.pageNum) && Math.abs(book.pageNum - pageNum) >= 5) {
            return true;
        }
        return false;
    }

    if (r1 && r1.author) {
        //use author as index to find
        let books = getByAuthor(r1.author);

        if (books && books.length > 0) {
            status = SAME_AUTHOR;
            for (let ii = 0; ii < books.length; ii++) {
                const book = books[ii];
                if (isPageNumDifferent(book, pageNum)) {
                    continue;
                }

                let fn2 = book.fileName;
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
        const _text = _clean(text);
        let reg = escapeRegExp(_text);
        let books = file_collection.chain()
            .find({ '_filename_': { '$regex': reg } })
            .data();

        books.forEach(e => {
            if (isPageNumDifferent(e, pageNum)) {
                return;
            }

            if (e._filename_ === _text) {
                status = IS_IN_PC;
            }

            if (status < LIKELY_IN_PC && isHighlySimilar(e._filename_, _text)) {
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


//--------------------------------------------------------------
function getCurrentTime() {
    return new Date().getTime();
}

const begTime = getCurrentTime();
const file_db = new loki();
const file_collection = file_db.addCollection("file_collection");

const escapeRegExp = function (string) {
    const str = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    var reg = new RegExp(str, 'i');
    return reg;
}

function getByAuthor(key) {
    key = _clean(key);
    let reg = escapeRegExp(key);
    return file_collection.chain()
        .find({ '_author_': { '$regex': reg } })
        .where(obj => {
            return isHighlySimilar(obj['_author_'], key);
        })
        .data();
}

function parseAllFiles(allFiles){
    console.time("parse_all_files");
    for (let row of allFiles) {
            const [fileName, title, author] = row;
            const fn = _clean(fileName);
            file_collection.insert({
                fileName,
                _filename_: fn,
                _author_: _clean(author),
                title,
            })
    }
    console.timeEnd("parse_all_files");
}

let is_list_page = false;

function highlightEhentaiThumbnail() {
    let nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));

    if (!nodes || nodes.length === 0) {
        return;
    }

    is_list_page = true;

    console.time("check_all_dom");
    nodes.forEach(e => {
        try {
            const subNode = e.getElementsByClassName("gl4t")[0];
            const thumbnailNode = e.getElementsByTagName("img")[0];
            const text = subNode.textContent;

            const pageNumDiv = e.querySelector(".gl5t").children[1].children[1];
            const pageNum = parseInt(pageNumDiv.textContent.split(" ")[0]);

            e.status = 0;
            if (text.includes("翻訳") || text.includes("翻译")) {
                return;
            }
            const r = parse(text);
            const { status, similarTitles } = checkIfDownload(text, pageNum);
            e.status = status || 0;
            if (status === IS_IN_PC) {
                subNode.style.color = "#61ef47";
                thumbnailNode.title = "明确已经下载过了";
            } else if (status === LIKELY_IN_PC) {
                subNode.style.color = "#efd41b";
                addTooltip(thumbnailNode, "电脑里面好像有", similarTitles)
            } else if (status === SAME_AUTHOR) {
                subNode.style.color = "#ef8787";
                const fns = getByAuthor(r.author).map(e => e.fileName);
                addTooltip(thumbnailNode, `下载同样作者“${r.author}”的书 ${fns.length}次`, fns, "same_author")
            }

            if (status) {
                if (r) {
                    appendLink(e, r.author);
                    if (status >= LIKELY_IN_PC) {
                        appendLink(e, r.title);
                    }
                } else {
                    appendLink(e, text);
                }

                subNode.style.fontWeight = 600;
            }
        } catch (e) {
            console.error(e);
        }
    });

    console.timeEnd("check_all_dom");
}

function highlightNyaa(){
    const  nodes = Array.prototype.slice.call(document.querySelectorAll(".table-bordered tr td:nth-child(2) a"))
    if (!nodes || nodes.length === 0) {
        return;
    }
    is_list_page = true;

    console.time("check_all_dom");
    nodes.forEach(node => {
        try {
            const text = node.textContent;
            // node.status = 0;
            const rr = parse(text);
            const { status, similarTitles } = checkIfDownload(text);
            // node.status = status || 0;
            if (status === IS_IN_PC) {
                // node.style.color = "#61ef47";
                node.style.textDecoration = "line-through";
                node.style.textDecorationColor = "green";
                node.title = "明确已经下载过了";
            } else if (status === LIKELY_IN_PC) {
                node.style.color = "#efd41b";
                addTooltip(node, "电脑里面好像有", similarTitles)
            } else if (status === SAME_AUTHOR) {
                node.style.color = "#ef8787";
                const fns = getByAuthor(rr.author).map(e => e.fileName);
                addTooltip(node, `下载同样作者“${rr.author}”的书 ${fns.length}次`, fns, "same_author")
            }

            // if (status) {
            //     if (r) {
            //         appendLink(e, r.author);
            //         if (status >= LIKELY_IN_PC) {
            //             appendLink(e, r.title);
            //         }
            //     } else {
            //         appendLink(e, text);
            //     }

            //     subNode.style.fontWeight = 600;
            // }
        } catch (e) {
            console.error(e);
        }
    });

    console.timeEnd("check_all_dom");

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




function GM_xmlhttpRequest_promise(method, api) {
    //tamper monkey have bug
    //timeout do not work
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: method,
            url: api,
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

function addSearchLinkForEhentai() {
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

function popMessage(text){
    if(is_list_page){
        Swal.fire({
            // title: 'EhentaiHighighliger',
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
            console.log("kill one low-rating dom");
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
const dev_port = 34213;
async function main() {
    if(IS_EHENTAI){
        ehentaiProtection()
        addSearchLinkForEhentai();
    }

    console.time("[api/exhentaiApi]");
    //server有两个port，根据不同deploy
    let api = `http://localhost:${production_port}/api/exhentaiApi`;
    let res = await GM_xmlhttpRequest_promise("GET", api);

    if(!res){
        api = `http://localhost:${dev_port}/api/exhentaiApi`;
        res = await GM_xmlhttpRequest_promise("GET", api);
    }
    console.timeEnd("[api/exhentaiApi]");
    if (res) {
        const text = res.responseText;
        const json = JSON.parse(text);
        parseAllFiles(json.allFiles)
        if(IS_EHENTAI){
            highlightEhentaiThumbnail();
        }else if (IS_NYAA){
            highlightNyaa();
        }
        popMessage("成功载入");
    } else {
        popMessage("载入失败");
        console.error("fail to api/exhentaiApi")
    }
}


main();