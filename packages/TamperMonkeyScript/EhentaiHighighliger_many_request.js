// ==UserScript==
// @name        EhentaiLight配合Shigureader
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
            const rr = parse(text);
            console.log(`${ii}/${nodes.length}  ${text}`)
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
                addTooltip(thumbnailNode, `下载同样作者“${rr.author}”的书 ${fns.length}次`, fns, "same_author")
            }

            if (rr) {
                appendLink(e, rr.author);
                appendLink(e, rr.title);
            } else {
                appendLink(e, text);
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