// ==UserScript==
// @name        EhentaiLight配合Shigureader
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_getResourceText
// @connect     localhost
// @namespace       Aji47
// @version         0.0.30
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

const nameParser = window.nameParser || {};
const parse = window.parse || (typeof nameParser.parse === "function" ? nameParser.parse : () => null);
const isHighlySimilar = function (s1, s2) {
    if (nameParser && typeof nameParser.isHighlySimilar === "function") {
        return nameParser.isHighlySimilar(s1, s2);
    }
    if (!s1 && !s2) {
        return true;
    }
    if (s1 && s2) {
        return s1.toLowerCase() === s2.toLowerCase();
    }
    return false;
};

//-------------------------------
const IS_IN_PC = 100;
const LIKELY_IN_PC = 70;
const SAME_AUTHOR = 20;
const TOTALLY_DIFFERENT = 0;

const EVERYTHING_PORT = 80;

let isServerUp = true;
let isEverythingServerUp = true;

function cleanString(str) {
    return str && str.replace(/[ \.\,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋￥：？]/g, "");
}

function oneInsideOne(s1, s2) {
    return s1 && s2 && (s1.includes(s2) || s2.includes(s1));
}

function extractMiddleChars(str, wantedSize = 10) {
    if (!str) {
        return "";
    }
    if (wantedSize >= str.length) {
        return str;
    } else {
        const startIndex = Math.floor((str.length - wantedSize) / 2);
        const endIndex = startIndex + wantedSize;
        return str.substring(startIndex, endIndex);
    }
}

function isTwoBookTheSame(fn1, fn2) {
    if (!fn1 || !fn2) {
        return TOTALLY_DIFFERENT;
    }

    fn1 = fn1.toLowerCase();
    fn2 = fn2.toLowerCase();

    const r1 = parse(fn1);
    const r2 = parse(fn2);

    if (!r1 || !r2) {
        return isHighlySimilar(fn1, fn2) ? LIKELY_IN_PC : TOTALLY_DIFFERENT;
    }

    const author1 = cleanString(r1.author);
    const author2 = cleanString(r2.author);
    const group1 = cleanString(r1.group);
    const group2 = cleanString(r2.group);

    if (author1 && author2) {
        const authorSimilar = isHighlySimilar(author1, author2);
        const crossSimilar = isHighlySimilar(author1, group2) || isHighlySimilar(author2, group1);
        if (!authorSimilar && !crossSimilar) {
            return TOTALLY_DIFFERENT;
        }
    }

    let result = author1 && author2 ? SAME_AUTHOR : TOTALLY_DIFFERENT;

    if (r1.comiket && r2.comiket && r1.comiket !== r2.comiket) {
        return result;
    }

    let isSimilarGroup;
    if ((group1 && !group2) || (!group1 && group2)) {
        isSimilarGroup = true;
    } else {
        isSimilarGroup = isHighlySimilar(group1, group2);
    }

    if (isSimilarGroup) {
        let title1 = cleanString(r1.title);
        let title2 = cleanString(r2.title);
        if (title1 === title2 || isHighlySimilar(title1, title2)) {
            result = IS_IN_PC;
        } else if (oneInsideOne(title1, title2)) {
            result = LIKELY_IN_PC;
        }
    }

    return result;
}

function buildEverythingQueries(text) {
    const queries = new Set();
    const parsed = parse(text);
    const cleanedText = text.replace(/[\[\](){}]/g, " ");

    const addQuery = (value, size = 12) => {
        if (!value) {
            return;
        }
        const candidate = value.trim();
        if (candidate.length >= 2) {
            queries.add(extractMiddleChars(candidate, Math.min(size, candidate.length)));
        }
    };

    if (parsed) {
        addQuery(parsed.author, 8);
        addQuery(parsed.group, 8);
        addQuery(parsed.title, 14);
    }

    cleanedText.split(/\s+/).forEach(token => {
        if (token && token.length >= 4) {
            queries.add(extractMiddleChars(token, Math.min(8, token.length)));
        }
    });

    addQuery(cleanedText, 12);
    addQuery(text, 12);

    return Array.from(queries).filter(Boolean);
}

async function searchEverythingServer(query) {
    const url = `http://localhost:${EVERYTHING_PORT}/?search=${encodeURIComponent(query)}&format=json&path_column=1&offset=0&limit=30`;
    const response = await fetch(url, { method: "GET", cache: "no-cache" });
    if (!response.ok) {
        throw new Error(`Everything server error ${response.status}`);
    }
    return response.json();
}

async function checkByEverything(text) {
    if (!isEverythingServerUp) {
        return { status: 0, similarTitles: [] };
    }

    const queries = buildEverythingQueries(text);
    const seen = new Set();
    const candidates = [];

    try {
        for (const q of queries) {
            try {
                const data = await searchEverythingServer(q);
                const results = data && (data.results || data.Result || data.result || []);
                const normalizedResults = Array.isArray(results) ? results : [];
                for (const item of normalizedResults) {
                    const name = item.name || item.Name || "";
                    const path = item.path || item.Path || "";
                    const displayName = path ? `${path}\\${name}` : name;
                    if (!displayName || seen.has(displayName)) {
                        continue;
                    }
                    seen.add(displayName);
                    candidates.push({
                        displayName,
                        name: name || displayName
                    });
                }
            } catch (err) {
                console.error("Everything search failed", q, err);
                isEverythingServerUp = false;
                break;
            }
        }
    } catch (error) {
        console.error(error);
        isEverythingServerUp = false;
    }

    if (!candidates.length) {
        return { status: 0, similarTitles: [] };
    }

    let bestScore = TOTALLY_DIFFERENT;
    const scoredCandidates = candidates.map(candidate => {
        const score = isTwoBookTheSame(text, candidate.name);
        if (score > bestScore) {
            bestScore = score;
        }
        return { ...candidate, score };
    });

    const filteredCandidates = scoredCandidates
        .filter(candidate => candidate.score > TOTALLY_DIFFERENT)
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);

    return {
        status: bestScore,
        similarTitles: filteredCandidates.map(candidate => candidate.displayName)
    };
}

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
    let status = 0;
    let similarTitles = [];

    if (isServerUp) {
        try {
            let api = `http://localhost:${production_port}/api/search/find_similar_file/${encodeURIComponent(text)}`;
            let res = await postData("POST", api);
            const data = res;
            similarTitles = data.map(e => e.fn);
            status = data[0]?.score || 0;
        } catch (e) {
            isServerUp = false;
            console.error(e);
        }
    }

    const everythingResult = await checkByEverything(text);
    const combinedSimilarTitles = new Set();
    similarTitles.forEach(t => combinedSimilarTitles.add(t));
    everythingResult.similarTitles.forEach(t => combinedSimilarTitles.add(t));

    status = Math.max(status, everythingResult.status);

    return {
        status,
        similarTitles: Array.from(combinedSimilarTitles)
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
    if(isServerUp || isEverythingServerUp){
        popMessage("成功载入");
    }else{
        popMessage("无法连接到ShiguReader或Everything服务器，无法使用搜索和高亮功能");
    }
}

main();
