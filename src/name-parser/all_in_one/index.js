/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./character-names.js":
/*!****************************!*\
  !*** ./character-names.js ***!
  \****************************/
/***/ ((module) => {

module.exports = [
//kankore  http://dunkel.halfmoon.jp/kancolle/
"長門", "陸奥", "伊勢", "日向", "雪風", "赤城", "加賀", "蒼龍", "飛龍", "島風", "吹雪", "白雪", "初雪", "深雪", "叢雲", "磯波", "綾波", "敷波", "大井", "北上", "金剛", "比叡", "榛名", "霧島", "鳳翔", "扶桑", "山城", "天龍", "龍田", "龍驤", "睦月", "如月", "皐月", "文月", "長月", "菊月", "三日月", "望月", "球磨", "多摩", "木曾", "長良", "五十鈴", "名取", "由良", "川内", "神通", "那珂", "千歳", "千代田", "最上", "古鷹", "加古", "青葉", "妙高", "那智", "足柄", "羽黒", "高雄", "愛宕", "摩耶", "鳥海", "利根", "筑摩", "飛鷹", "隼鷹", "朧", "曙", "漣", "潮", "暁", "響", "雷", "電", "初春", "子日", "若葉", "初霜", "白露", "時雨", "村雨", "夕立", "五月雨", "涼風", "朝潮", "大潮", "満潮", "荒潮", "霰", "霞", "陽炎", "不知火", "黒潮", "祥鳳", "千歳甲", "千代田甲", "千歳航", "千代田航", "翔鶴", "瑞鶴", "鬼怒", "阿武隈", "夕張", "瑞鳳", "三隈", "初風", "舞風", "衣笠", "伊19", "鈴谷", "熊野", "伊168", "伊58", "伊8", "大和", "秋雲", "夕雲", "巻雲", "長波", "阿賀野", "能代", "矢矧", "酒匂", "武蔵", "Верный", "大鳳", "香取", "伊401", "あきつ丸", "神威", "まるゆ", "弥生", "卯月", "磯風", "浦風", "谷風", "浜風", "Bismarck", "Bismarck zwei", "Z1", "Z3", "Prinz Eugen", "Bismarck drei", "Z1 zwei", "Z3 zwei", "天津風", "明石", "大淀", "大鯨", "龍鳳", "時津風", "雲龍", "天城", "葛城", "春雨", "早霜", "清霜", "朝雲", "山雲", "野分", "秋月", "照月", "初月", "高波", "朝霜", "U-511", "Graf Zeppelin", "Saratoga", "呂500", "Warspite", "Iowa", "Littorio", "Roma", "Libeccio", "Aquila", "秋津洲", "Italia", "Zara", "Pola", "瑞穂", "沖波", "風雲", "嵐", "萩風", "親潮", "山風", "海風", "江風", "速吸", "鹿島", "神風", "朝風", "春風", "松風", "旗風", "天霧", "狭霧", "水無月", "伊26", "浜波", "藤波", "浦波", "Commandant Teste", "Richelieu", "伊400", "伊13", "伊14", "Zara due", "Гангут", "Ташкент", "Ark Royal", "Гангут два", "占守", "国後", "Jervis", "春日丸", "神鷹", "Luigi Torelli", "大鷹", "岸波", "UIT-25", "伊504", "涼月", "択捉", "松輪", "佐渡", "対馬", "日振", "大東", "福江", "Nelson", "Gotland", "Maestrale", "穂乃果", "ことり", "エルフ"].filter(function (e) {
  return e.length > 1;
});

/***/ }),

/***/ "./index.js":
/*!******************!*\
  !*** ./index.js ***!
  \******************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(arr, i) { var _i = null == arr ? null : "undefined" != typeof Symbol && arr[Symbol.iterator] || arr["@@iterator"]; if (null != _i) { var _s, _e, _x, _r, _arr = [], _n = !0, _d = !1; try { if (_x = (_i = _i.call(arr)).next, 0 === i) { if (Object(_i) !== _i) return; _n = !1; } else for (; !(_n = (_s = _x.call(_i)).done) && (_arr.push(_s.value), _arr.length !== i); _n = !0); } catch (err) { _d = !0, _e = err; } finally { try { if (!_n && null != _i["return"] && (_r = _i["return"](), Object(_r) !== _r)) return; } finally { if (_d) throw _e; } } return _arr; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
var config = __webpack_require__(/*! ./name-parser-config */ "./name-parser-config.js");
var same_tag_regs_table = config.same_tag_regs_table;
var not_author_but_tag = config.not_author_but_tag;
var char_names = __webpack_require__(/*! ./character-names */ "./character-names.js");
//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
var char_name_regex = new RegExp(char_names.join("|"));
var not_author_but_tag_regex = new RegExp(not_author_but_tag.join("$|") + "$", "i");
var useless_tag_regex = /DL版|同人誌|別スキャン|修正版|^エロ|^digital$|^JPG|^PNG|ページ補足|進行中|別版|Various/i;
function isUselessTag(str) {
  return !!str.match(useless_tag_regex);
}
var media_types = ["同人音声", "同人催眠音声", "同人ソフト", "同人CG集", "同人CG", "同人ゲーム", "同人GAME", "成年コミック", "一般コミック", "一般漫画", "ゲームCG", "イラスト集", "アンソロジー", "画集", "雑誌", "18禁ゲーム", "GAME", "CG", "同人誌", "DOUJINSHI"];
var media_type_regex = new RegExp(media_types.map(function (e) {
  return "(".concat(e, ")");
}).join("|"), "i");
function isMediaType(str) {
  return !!str.match(media_type_regex);
}
function getMediaType(str) {
  var res = str.match(media_type_regex) || [];
  return res[0];
}
var same_tag_matrix = [];
for (var tag in same_tag_regs_table) {
  if (same_tag_regs_table.hasOwnProperty(tag)) {
    var big_pre_join = same_tag_regs_table[tag].map(function (e) {
      return e.source;
    });
    var r = new RegExp(big_pre_join.join("|"), 'i');
    var row = [r, tag];
    same_tag_matrix.push(row);
  }
}
same_tag_matrix.sort(function (r1, r2) {
  return r2[1].length - r1[1].length;
});
var localCache = {};
var comicket_reg = /^C\d{2}$/i;
var comicket_reg_2 = /^C1\d{2}$/i;
var air_comicket_reg = /^エアコミケ\d{1}$/i;
var comic_star_reg = /^COMIC1☆\d{1,2}$/i;
var love_live_event_reg = /^僕らのラブライブ!/i;
var comitea_reg = /^コミティア.*\d/;
var sankuri_reg = /^サンクリ.*\d+/;
var reitaisai_reg = /^例大祭.*\d+/;
var tora_reg = /^とら祭り.*\d+/;
var komitore_reg = /^こみトレ.*\d+/;
var reg_list = [comicket_reg, air_comicket_reg, comicket_reg_2, comic_star_reg, love_live_event_reg, comitea_reg, sankuri_reg, reitaisai_reg, tora_reg, komitore_reg, /みみけっと.*\d+/, /コミトレ.*\d+/, /FF\d+/, /iDOL SURVIVAL.*\d/i, /SC\d+/, /コミコミ.*\d/, /ふたけっと.*\d/, /ファータグランデ騎空祭/, /歌姫庭園/, /紅楼夢/, /CSP\d/, /CC大阪\d/, /COMITIA\d/];
var event_reg = new RegExp(reg_list.map(function (e) {
  return e.source;
}).join("|"), "i");
function belongToEvent(str) {
  return !!str.match(event_reg);
}
var comiket_to_date_table = {};
function getDateFromParse(str) {
  var pp = parse(str);
  var result;
  if (pp) {
    if (pp.dateTag) {
      result = getDateFromStr(pp.dateTag);
    } else if (pp.comiket) {
      result = getDateFromComiket(pp.comiket);
    }
  }
  return result;
}

//for sort algo, not very accurate
function getDateFromComiket(comiket) {
  var result = null;
  var num;
  var year;
  var month;
  if (comiket_to_date_table[comiket]) {
    result = comiket_to_date_table[comiket];
  } else if (comiket.match(comicket_reg)) {
    comiket = comiket.replace("C", "");
    num = parseInt(comiket);
    year = Math.floor(num / 2) + 1971;
    var isSummer = num % 2 === 0;
    month = isSummer ? 8 : 11;
    var day = isSummer ? 10 : 28;
    result = new Date(year, month, day);
  } else if (comiket.match(air_comicket_reg)) {
    comiket = comiket.replace("エアコミケ", "");
    num = parseInt(comiket);
    if (num === 1) {
      result = new Date(2020, 7, 30);
    } else {
      result = new Date(2020, 11, 30);
    }
  } else if (comiket.match(comicket_reg_2)) {
    comiket = comiket.replace("C", "");
    num = parseInt(comiket);
    result = new Date(2022, 8, 13);
  } else if (comiket.match(comic_star_reg)) {
    comiket = comiket.replace("COMIC1☆", "");
    num = parseInt(comiket);
    if (num <= 10) {
      //once per year
      result = new Date(2006 + num, 3, 30);
    } else {
      num = num - 10;
      year = 2017 + Math.floor(num / 2);
      month = num % 2 === 0 ? 10 : 4;
      result = new Date(year, month, 30);
    }
  }
  if (result) {
    comiket_to_date_table[comiket] = result;
  }
  return result;
}
function getDateFromStr(str) {
  var mresult = str.match(date_reg);
  if (mresult) {
    var _mresult$filter = mresult.filter(function (e) {
        return !!e;
      }),
      _mresult$filter2 = _slicedToArray(_mresult$filter, 4),
      wholeMatch = _mresult$filter2[0],
      y = _mresult$filter2[1],
      m = _mresult$filter2[2],
      d = _mresult$filter2[3];
    y = convertYearString(y);
    m = parseInt(m) - 1;
    d = parseInt(d) || 1;
    if (m < 0 || m > 11) {
      return undefined;
    } else if (d < 1 || d > 31) {
      return undefined;
    }
    return new Date(y, m, d);
  }
}
function convertYearString(y) {
  if (y.length === 2) {
    y = parseInt(y);
    if (y > 70) {
      y = 1900 + y;
    } else {
      y = 2000 + y;
    }
  } else {
    y = parseInt(y);
  }
  return y;
}
function isDateValid(date) {
  // An invalid date object returns NaN for getTime() and NaN is the only
  // object not strictly equal to itself.
  return date.getTime() === date.getTime();
}
;
var dreg0 = /(\d{4})(\d{1,2})(\d{2})/;
var dreg1 = /(\d{2})(\d{2})(\d{2})/;
var dreg2 = /(\d{2})-(\d{2})-(\d{2})/;
var dreg3 = /(\d{4})-(\d{1,2})-(\d{2})/;
var dreg4 = /(\d{4})年(\d{1,2})月号/;
var dreg5 = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
var dreg6 = /(\d{4})\.(\d{1,2})\.(\d{1,2})/;
var date_reg = new RegExp([dreg0, dreg1, dreg2, dreg3, dreg4, dreg5, dreg6].map(function (e) {
  return e.source;
}).join("|"), "i");
function isStrDate(str) {
  if (str.match(date_reg)) {
    var dd = getDateFromStr(str);
    return !!(dd && isDateValid(dd));
  }
}
var groupAndNameReg = /^(.*?)\s*\((.*?)\)$/;
function getGroupAndName(str) {
  var macthes = str.match(groupAndNameReg);
  if (macthes && macthes.length > 0) {
    return {
      group: macthes[1].trim(),
      name: macthes[2].trim()
    };
  } else {
    return {
      name: str.trim()
    };
  }
}
function match(reg, str) {
  var result = [];
  var token = reg.exec(str);
  while (token) {
    result.push(token[1]);
    token = reg.exec(str);
  }
  return result;
}
function isNotAuthor(str) {
  return str.match(not_author_but_tag_regex);
}
function findMaxStr(arr) {
  var res = arr[0];
  arr.forEach(function (e) {
    if (e.length > res.length) {
      res = e;
    }
  });
  return res;
}
var pReg = /\((.*?)\)/g;
var bReg = /\[(.*?)\]/g;
var seperator = /,|、|&|＆/;
function getLocalCache() {
  return localCache;
}
function setLocalCache(newLocache) {
  for (var key in newLocache) {
    if (!newLocache.hasOwnProperty(key)) {
      continue;
    }
    var obj = newLocache[key];
    localCache[key] = obj;
  }
}
function parse(str) {
  if (!str || localCache[str] === "NO_EXIST") {
    return null;
  }
  if (localCache[str]) {
    return localCache[str];
  }
  var bMacthes = match(bReg, str); //[]
  var pMacthes = match(pReg, str); //()

  var hasB = bMacthes && bMacthes.length > 0;
  var hasP = pMacthes && pMacthes.length > 0;
  if (!hasB && !hasP) {
    localCache[str] = "NO_EXIST";
    return;
  }
  var author;
  var authors = [];
  var group;
  var dateTag;
  var comiket;
  var type;
  var tags = [];
  function isOtherInfo(token) {
    var result = false;
    if (isMediaType(token)) {
      type = getMediaType(token);
      result = true;
    } else if (belongToEvent(token)) {
      comiket = token;
      result = true;
    } else if (isStrDate(token)) {
      dateTag = token; //e.g 190214
      result = true;
    } else if (isUselessTag(token)) {
      //nothing
      result = true;
    }
    return result;
  }

  // looking for author, avoid 6 year digit
  if (bMacthes && bMacthes.length > 0) {
    for (var ii = 0; ii < bMacthes.length; ii++) {
      var token = bMacthes[ii].trim();
      var tt = token.toLowerCase();
      var nextCharIndex = str.indexOf(bMacthes[ii]) + bMacthes[ii].length + 1;
      var nextChar = str[nextCharIndex];
      if (isOtherInfo(token)) {
        continue;
      }
      if (isNotAuthor(tt)) {
        //e.g pixiv is not author
        tags.push(token);
      } else if (nextChar === "." || nextCharIndex >= str.length) {
        //e.g KI-RecenT SP02 NATURALCORDE [DL版].zip
        // [DL版] is not auhor name
        tags.push(token);
      } else if (!author) {
        //  [真珠貝(武田弘光)]
        var temp = getGroupAndName(token);
        if (temp.name && !isNotAuthor(temp.name)) {
          //e.g よろず is not author
          author = temp.name;
          authors = author.split(seperator).map(function (e) {
            return e.trim();
          });
        }
        group = temp.group;
      } else {
        tags.push(token);
      }
    }
  }

  //---------------handle tags
  if (pMacthes && pMacthes.length > 0) {
    var _tags;
    (_tags = tags).push.apply(_tags, _toConsumableArray(pMacthes));
  }

  //seperate
  var tseperator = /,|、/;
  var tempTags = [];
  tags.forEach(function (t) {
    tempTags.push.apply(tempTags, _toConsumableArray(t.split(tseperator)));
  });
  tags = tempTags;
  tags = tags.map(function (e) {
    return e.trim();
  });
  tags = tags.filter(function (e) {
    return e.length > 1 && !isOtherInfo(e) && authors.indexOf(e) === -1 && e !== author;
  });
  tags = tags.filter(function (e) {
    return !isUselessTag(e) && !isMediaType(e);
  });
  var rawTags = tags.slice();
  tags = tags.map(function (e) {
    e = e.replace(/ {2,}/g, " ").replace(/。/g, "").replace(/！/g, "!").replace(/？/g, "?");

    //tag reducing
    var converts = [];
    for (var _ii = 0; _ii < same_tag_matrix.length; _ii++) {
      var _row = same_tag_matrix[_ii];
      var _r2 = _row[0];
      if (e.match(_r2)) {
        converts.push(_row[1]);
      }
    }
    if (converts.length > 0) {
      return findMaxStr(converts);
    } else {
      return e;
    }
  });
  if (!type) {
    if (comiket || group) {
      type = "Doujin";
    } else {
      type = "etc";
    }
  }
  if (!author && !group && tags.length === 0) {
    localCache[str] = "NO_EXIST";
    return;
  }

  //get title
  var title = str;
  (bMacthes || []).concat(pMacthes || [], tags || [], [/\[/g, /\]/g, /\(/g, /\)/g]).forEach(function (e) {
    title = title.replace(e, "");
  });
  if (title.includes(".")) {
    title = title.split(".")[0];
  }
  title = title.trim();

  //get character names
  var charNames = [];
  if (char_name_regex) {
    var names = title.match(char_name_regex);
    if (names) {
      charNames.push.apply(charNames, _toConsumableArray(names));
    }
  }
  var extraTags = getExtraTags(title);
  var result = {
    // 日期tag：比如 20220312
    dateTag: dateTag,
    // 同人的group
    group: group,
    // 作者。其实有点不对，因为有的是有多作者的
    author: author,
    // 作者list
    authors: authors,
    // tags 已过变形处理
    tags: tags,
    // 用regex从string找到的角色名字
    charNames: charNames,
    // extrac tags
    extraTags: extraTags,
    // 未经转换的tags
    rawTags: rawTags,
    // 比如 c101
    comiket: comiket,
    // 类型
    type: type,
    // 标题
    title: title
  };
  localCache[str] = result;
  return result;
}
function getExtraTags(str) {
  // [161109] TVアニメ「ラブライブ！サンシャイン!!」挿入歌シングル3「想いよひとつになれ／MIRAI TICKET」／Aqours [320K].zip
  //[180727]TVアニメ『音楽少女』OPテーマ「永遠少年」／小倉唯[320K].rar
  var jpbReg = /「(.*?)」/g;
  var macthes = match(jpbReg, str) || [];
  var jpbReg2 = /『(.*?)』/g;
  var macthes2 = match(jpbReg2, str) || [];
  return macthes.concat(macthes2).map(function (e) {
    return e.trim();
  });
}

// https://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
function editDistance(s, t) {
  if (s === t) {
    return 0;
  }
  var n = s.length,
    m = t.length;
  if (n === 0 || m === 0) {
    return n + m;
  }
  var x = 0,
    y,
    a,
    b,
    c,
    d,
    g,
    h,
    k;
  var p = new Array(n);
  for (y = 0; y < n;) {
    p[y] = ++y;
  }
  for (; x + 3 < m; x += 4) {
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
        c = a > b ? b + 1 : a + 1;
      } else {
        if (e1 !== k) {
          c++;
        }
      }
      if (c < b || d < b) {
        b = c > d ? d + 1 : c + 1;
      } else {
        if (e2 !== k) {
          b++;
        }
      }
      if (b < d || g < d) {
        d = b > g ? g + 1 : b + 1;
      } else {
        if (e3 !== k) {
          d++;
        }
      }
      if (d < g || h < g) {
        g = d > h ? h + 1 : d + 1;
      } else {
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
        d = a > d ? d + 1 : a + 1;
      } else {
        if (e !== s.charCodeAt(y)) {
          d = c + 1;
        } else {
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

//---------------------

function compareInternalDigit(s1, s2) {
  var digitTokens1 = s1.match(/\d+/g);
  var digitTokens2 = s2.match(/\d+/g);
  if (digitTokens1 && digitTokens2) {
    if (digitTokens1.length !== digitTokens2.length || digitTokens1.join() !== digitTokens2.join()) {
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
    var distance = editDistance(s1, s2);
    var avgLen = (s1.length + s2.length) / 2;
    var ratio = distance / Math.ceil(avgLen);
    return ratio <= 0.2;
  } else {
    return false;
  }
}
module.exports = {
  isUselessTag: isUselessTag,
  isMediaType: isMediaType,
  getMediaType: getMediaType,
  belongToEvent: belongToEvent,
  convertYearString: convertYearString,
  editDistance: editDistance,
  getDateFromStr: getDateFromStr,
  parse: parse,
  getDateFromComiket: getDateFromComiket,
  getDateFromParse: getDateFromParse,
  getLocalCache: getLocalCache,
  setLocalCache: setLocalCache,
  isHighlySimilar: isHighlySimilar
};

/***/ }),

/***/ "./name-parser-config.js":
/*!*******************************!*\
  !*** ./name-parser-config.js ***!
  \*******************************/
/***/ ((module) => {

module.exports.same_tag_regs_table = {
  "東方Project": [/^東方$/, /Touhou\s*Project/, /東方project/],
  "オリジナル": [/^Original$/],
  "Kanon": [/カノン|Kanon/],
  "艦これ": [/艦これ|舰これ/, /艦隊これくしょん/, /Kantai\s*Collection/, /KanColle/],
  "ラブライブ!": [/Love Live/, /ラブライブ/],
  "ラブライブ!サンシャイン!!": [/ラブライブ.*サンシャイン.*/],
  "プリンセスコネクト!Re:Dive": [/プリンセスコネクト.*Re.*Dive/],
  "Fate／Grand Order": [/Fate.*Grand.*Order/, /FGO/],
  "Fate／Stay Night": [/Fate.*Stay.*Night/],
  "Fate／Zero": [/Fate.*Zero/],
  "Fate／kaleid liner プリズマ☆イリヤ": [/Fate.*kaleid.*liner.*プリズマ.*イリヤ/, /Fate.*kaleid.*liner/, /プリズマ.*イリヤ/],
  "Fate": [/^Fate\s*／*\w+/],
  "アイドルマスター": [/アイドルマスタ/, /DOL.*M@STER/, /dol.*master/, /アイマス/],
  "アイドルマスター シンデレラガールズ": [/アイドルマスター.*シンデレラガールズ/, /DOLM@STER.*CINDERELLA.*GIRLS/],
  "アイドルマスター ミリオンライブ": [/アイドルマスター.*ミリオン/, /ミリオンライブ/],
  "アイドルマスター シャイニーカラーズ": [/アイドルマスター.*シャイニーカラーズ/],
  "アズールレーン": [/Azur Lane/],
  "ガールズ&パンツァー": [/Girls.*nd.*Panzer/],
  "けいおん": [/けいおん/, /K-ON/],
  "プリキュア": [/プリキュア/],
  "To LOVEる": [/To.*LOVEる/, /To.*LOVE.*ru/],
  "魔法少女まどか☆マギカ": [/まどか.*マギカ|PuellaMagiMadoka/],
  "アイカツ!": [/アイカツ.*/],
  "エヴァンゲリオン": [/エヴァンゲリオン/, /^エヴァ$/, /Evangelion/],
  "Angel Beats": [/Angel.*Beats.*/, /エンジェル.*ビーツ/],
  "Dead Or Alive": [/Dead Or Alive/, /デッド.*オア.*アライヴ/, /DEADorALIVE/],
  "IS ＜インフィニット・ストラトス＞": [/S.*インフィニット.*ストラトス.*/, /インフィニット.*ストラトス/],
  "D.C～ダ・カーポ": [/D\.C\./, /ダ.*カーポ/],
  "Dog Days": [/Dog.*Days.*/],
  "Dream C Club": [/Dream.*C.*Club/],
  "ガンダム ": [/ガンダム|gundam/],
  "コードギアス": [/コードギアス/],
  "ご注文はうさぎですか": [/ご注文はうさぎですか/],
  "ソードアート・オンライン": [/ソードアート.*オンライン/, /Sword\s*Art\s*Online/],
  "ダンガンロンパ": [/ダンガンロンパ/],
  "ドラゴンクエスト": [/ドラゴンクエスト/, /Dragon\s*Quest/],
  "ファイナルファンタジー": [/ファイナルファンタジー|FinalFantasy/],
  "咲 -Saki-": [/咲.*Saki.*/],
  "咲-Saki- 阿知賀編": [/咲.*Saki.*阿知賀編/],
  "聖剣伝説": [/聖剣伝説/],
  "閃乱カグラ": [/閃乱カグラ/],
  "魔法少女リリカルなのは": [/魔法少女リリカルなのは.*|Nanoha$|^なのは$/],
  "キング・オブ・ファイター": [/キング\.オブ\.ファイター/, /^KOF$/],
  "ファイアーエムブレム": [/ファイアーエムブレム/],
  "ファンタシースター": [/ファンタシースター|PhantasyStar/],
  "To Heart 2": [/To.*Heart.*2|トゥハート2/]
};
module.exports.not_author_but_tag = ["同人音声", "同人誌", "アンソロジー", "DL版", "よろず", "成年コミック", "Pixiv", "アーティスト", "雑誌", "English", "Chinese", "320K"];

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./index.js");
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map