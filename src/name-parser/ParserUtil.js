// https://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
function editDistance(s, t) {
    if (s === t) {
        return 0;
    }
    var n = s.length, m = t.length;
    if (n === 0 || m === 0) {
        return n + m;
    }
    var x = 0, y, a, b, c, d, g, h, k;
    var p = new Array(n);
    for (y = 0; y < n;) {
        p[y] = ++y;
    }

    for (; (x + 3) < m; x += 4) {
        var e1 = t.charCodeAt(x);
        var e2 = t.charCodeAt(x + 1);
        var e3 = t.charCodeAt(x + 2);
        var e4 = t.charCodeAt(x + 3);
        c = x;
        b = x + 1;
        d = x + 2;
        g = x + 3;
        h = x + 4;
        for (y = 0; y < n; y++) {
            k = s.charCodeAt(y);
            a = p[y];
            if (a < c || b < c) {
                c = (a > b ? b + 1 : a + 1);
            }
            else {
                if (e1 !== k) {
                    c++;
                }
            }

            if (c < b || d < b) {
                b = (c > d ? d + 1 : c + 1);
            }
            else {
                if (e2 !== k) {
                    b++;
                }
            }

            if (b < d || g < d) {
                d = (b > g ? g + 1 : b + 1);
            }
            else {
                if (e3 !== k) {
                    d++;
                }
            }

            if (d < g || h < g) {
                g = (d > h ? h + 1 : d + 1);
            }
            else {
                if (e4 !== k) {
                    g++;
                }
            }
            p[y] = h = g;
            g = d;
            d = b;
            b = c;
            c = a;
        }
    }

    for (; x < m;) {
        var e = t.charCodeAt(x);
        c = x;
        d = ++x;
        for (y = 0; y < n; y++) {
            a = p[y];
            if (a < c || d < c) {
                d = (a > d ? d + 1 : a + 1);
            }
            else {
                if (e !== s.charCodeAt(y)) {
                    d = c + 1;
                }
                else {
                    d = c;
                }
            }
            p[y] = d;
            c = a;
        }
        h = d;
    }

    return h;
}

function getExtraTags(str) {
    // [161109] TVアニメ「ラブライブ！サンシャイン!!」挿入歌シングル3「想いよひとつになれ／MIRAI TICKET」／Aqours [320K].zip
    //[180727]TVアニメ『音楽少女』OPテーマ「永遠少年」／小倉唯[320K].rar
    let jpbReg = /「(.*?)」/g;
    const macthes = matchAll(jpbReg, str) || [];

    let jpbReg2 = /『(.*?)』/g;
    const macthes2 = matchAll(jpbReg2, str) || [];

    return (macthes.concat(macthes2)).map(e => {
        return e.trim();
    })
}

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

function isHighlySimilar(s1, s2) {
    if (!s1 && !s2) {
        return true;
    } else if (s1 && s2) {
        if (!compareInternalDigit(s1, s2)) {
            return false;
        }

        const distance = editDistance(s1, s2);
        const avgLen = (s1.length + s2.length) / 2;
        const ratio = distance / (Math.ceil(avgLen));

        return ratio <= 0.2;
    } else {
        return false;
    }
}

function matchAll(reg, str) {
    const result = [];
    var token = reg.exec(str);
    while (token) {
        if(token[1]){
            result.push(token[1]);
        }
        token = reg.exec(str);
    }
    return result;
}

module.exports = {
    editDistance,
    getExtraTags,
    compareInternalDigit,
    isHighlySimilar,
    matchAll
}