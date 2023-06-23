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
const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;
const TOTALLY_DIFFERENT = 0;

async function checkIfDownload(text) {
    var status = 0;
    let similarTitles = [];

    try{
        let api = `http://localhost:${production_port}/api/findSimilarFile/${text}`;
        let res = await GM_xmlhttpRequest_promise("POST", api);
        const json = JSON.parse(res.responseText);
    
        similarTitles = json.map(e => e.fn);
        status = json[0]?.score;
    }catch(e){
        console.error(e);
    }

    return {
        status,
        similarTitles
    }
}



//--------------------------------------------------------------
function getCurrentTime() {
    return new Date().getTime();
}

const begTime = getCurrentTime();
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
                return;
            }
            const r = parse(text);
            const { status, similarTitles } = await checkIfDownload(text);
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
            // node.status = 0;
            const rr = parse(text);
            const { status, similarTitles } = await checkIfDownload(text);
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
    };

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
async function main() {
    if(IS_EHENTAI){
        ehentaiProtection()
        addSearchLinkForEhentai();
    }

    console.time("------------ONE PAGE")
    if(IS_EHENTAI){
        await highlightEhentaiThumbnail();
    }else if (IS_NYAA){
        await highlightNyaa();
    }
    console.timeEnd("------------ONE PAGE")
    popMessage("成功载入");

}


main();