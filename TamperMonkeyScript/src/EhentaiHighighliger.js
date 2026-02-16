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
    opacity: 0.3;
    transition: opacity 0.3s;
}
.disappear_dom:hover {
    opacity: 1 !important;
}

`);

const IS_EHENTAI = window.location.hostname.includes("exhentai") || window.location.hostname.includes("e-hentai");
const IS_NYAA = window.location.hostname.includes("nyaa");

const production_port = 3000;
const QUICK_MATCH_BATCH_SIZE = 20;
const QUICK_MATCH_LIMIT = 5;

const MATCH_LEVEL_STYLE = {
    downloaded: { color: "#61ef47", message: "明确已下载" },
    likely: { color: "#efd41b", message: "高概率已下载" },
    same_author: { color: "#ef8787", message: "同作者，但不是同一本" },
    different: { color: "", message: "未发现明显匹配" },
};

let isServerUp = true;
let is_list_page = false;

const queryCache = new Map();

function chunkArray(input, chunkSize) {
    if (!Array.isArray(input) || chunkSize <= 0) {
        return [input || []];
    }
    const out = [];
    for (let i = 0; i < input.length; i += chunkSize) {
        out.push(input.slice(i, i + chunkSize));
    }
    return out;
}

async function requestJson(url, method, body, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method,
            cache: "no-cache",
            headers: {
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function buildSearchUrl(text) {
    return `http://localhost:${production_port}/search?q=${encodeURIComponent((text || "").trim())}`;
}

function appendSearchLink(fileTitleDom, text, label = "Find in ShiguReader") {
    if (!fileTitleDom) {
        return;
    }
    const trimmed = (text || "").trim();
    if (!trimmed) {
        return;
    }

    const link = document.createElement("a");
    link.textContent = label;
    link.title = trimmed;
    link.style.display = "block";
    link.style.marginTop = "8px";
    link.style.marginBottom = "8px";
    link.target = "_blank";
    link.className = "shigureader_link";
    link.href = buildSearchUrl(trimmed);
    fileTitleDom.append(link);
}

function addTooltip(node, summary, result) {
    if (!node || !result) {
        return;
    }
    const hits = (result.hits || []).slice(0, 8).map((h, ii) => {
        const idx = String(ii + 1).padStart(2, "0");
        return `  ${idx}. ${h.name} [${h.match_level}] (${h.confidence})`;
    });
    node.title = [
        node.title || "",
        summary,
        `reason: ${result.reason || "unknown"}`,
        `confidence: ${result.confidence ?? 0}`,
        hits.length > 0 ? "--- top hits ---" : "",
        ...hits,
    ].filter(Boolean).join("\n");
}

function applyMatchStyleToEhentaiTitleNode(subNode, imageNode, result) {
    const level = result?.match_level || "different";
    const style = MATCH_LEVEL_STYLE[level] || MATCH_LEVEL_STYLE.different;
    if (style.color) {
        subNode.style.color = style.color;
    }
    subNode.style.fontWeight = 600;
    addTooltip(imageNode, style.message, result);
}

function applyMatchStyleToNyaaTitleNode(node, result) {
    const level = result?.match_level || "different";
    const style = MATCH_LEVEL_STYLE[level] || MATCH_LEVEL_STYLE.different;

    if (level === "downloaded") {
        node.style.textDecoration = "line-through";
        node.style.textDecorationColor = "green";
    } else if (style.color) {
        node.style.color = style.color;
    }
    addTooltip(node, style.message, result);
}

async function quickMatchBatch(queries) {
    if (!isServerUp || !queries || queries.length === 0) {
        return new Map();
    }

    const uniqueQueries = Array.from(new Set(queries.map(q => (q || "").trim()).filter(Boolean)));
    const pending = uniqueQueries.filter(q => !queryCache.has(q));

    try {
        const api = `http://localhost:${production_port}/api/search/quick-match-batch`;
        const chunks = chunkArray(pending, QUICK_MATCH_BATCH_SIZE);

        for (const chunk of chunks) {
            if (!chunk.length) {
                continue;
            }
            const payload = {
                queries: chunk,
                limit: QUICK_MATCH_LIMIT,
                chunk_size: QUICK_MATCH_BATCH_SIZE,
                presence_filter: "all",
            };
            const res = await requestJson(api, "POST", payload, 4000);
            const results = res && Array.isArray(res.results) ? res.results : [];
            results.forEach((item) => {
                if (item && item.q) {
                    queryCache.set(item.q, item);
                }
            });
        }
    } catch (e) {
        isServerUp = false;
        console.error("quick-match-batch failed", e);
    }

    const out = new Map();
    uniqueQueries.forEach(q => {
        out.set(q, queryCache.get(q) || null);
    });
    return out;
}

function popMessage(text) {
    if (!is_list_page) {
        return;
    }
    Swal.fire({
        html: text,
        timer: 1000,
        backdrop: false,
        width: "240px",
        position: "top-end",
    });
}

/**
 * ehentai防瞎眼
 */
function ehentaiProtection() {
    function disappearNode(node) {
        if (node) {
            node.classList.add("disappear_dom");
            console.log("hide (transparent) one low-rating dom");
        }
    }

    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    nodes.forEach(node => {
        const star = node.querySelector(".ir");
        if (!star) {
            return;
        }
        const rawPos = window.getComputedStyle(star)["backgroundPosition"];
        const tokens = rawPos.split(" ");
        if (tokens.length !== 2) {
            return;
        }

        const pos = tokens.map(tt => parseInt(tt.replace("px", "")));
        const [x, y] = pos;
        const THRESHOLD = -48; // 2 star
        if (y === -21) {
            if (x <= THRESHOLD) {
                disappearNode(node);
            }
        } else if (x <= THRESHOLD) {
            disappearNode(node);
        }
    });
}

async function highlightEhentaiThumbnail() {
    const cards = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    if (!cards || cards.length === 0) {
        return;
    }

    is_list_page = true;
    const entries = [];
    cards.forEach((card) => {
        const subNode = card.getElementsByClassName("gl4t")[0];
        const thumbnailNode = card.getElementsByTagName("img")[0];
        const text = (subNode && subNode.textContent || "").trim();
        if (!subNode || !text) {
            return;
        }
        if (text.includes("翻訳") || text.includes("翻译")) {
            return;
        }
        entries.push({ card, subNode, thumbnailNode, text });
    });

    const resultMap = await quickMatchBatch(entries.map(e => e.text));

    entries.forEach((entry) => {
        const result = resultMap.get(entry.text) || { match_level: "different", hits: [] };
        applyMatchStyleToEhentaiTitleNode(entry.subNode, entry.thumbnailNode, result);
        appendSearchLink(entry.card, entry.text, "Quick Search");
    });
}

async function highlightNyaa() {
    const nodes = Array.prototype.slice.call(document.querySelectorAll(".table-bordered tr td:nth-child(2) a"));
    if (!nodes || nodes.length === 0) {
        return;
    }

    is_list_page = true;
    const entries = nodes
        .map((node) => ({ node, text: (node.textContent || "").trim() }))
        .filter((e) => !!e.text);

    const resultMap = await quickMatchBatch(entries.map(e => e.text));

    entries.forEach((entry) => {
        const result = resultMap.get(entry.text) || { match_level: "different", hits: [] };
        applyMatchStyleToNyaaTitleNode(entry.node, result);
    });
}

function addSearchLinkForEhentai() {
    let fileTitleDom = document.getElementById("gj");
    let title = fileTitleDom && fileTitleDom.textContent;

    if (!title) {
        fileTitleDom = document.getElementById("gn");
        title = fileTitleDom && fileTitleDom.textContent;
    }

    if (title && fileTitleDom) {
        appendSearchLink(fileTitleDom, title, "Find in ShiguReader");
    }
}

async function main() {
    if (IS_EHENTAI) {
        ehentaiProtection();
    }

    if (IS_EHENTAI) {
        await highlightEhentaiThumbnail();
        addSearchLinkForEhentai();
    } else if (IS_NYAA) {
        await highlightNyaa();
    }

    if (isServerUp) {
        popMessage("ShiguReader 高亮已载入");
    } else {
        popMessage("无法连接 ShiguReader：已降级为仅显示搜索链接");
    }
}

main();