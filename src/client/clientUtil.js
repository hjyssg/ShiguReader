const util = require("@common/util");
const Cookie = require("js-cookie");
const _ = require("underscore");
const filesizeUitl = require('filesize');
const queryString = require('query-string');

module.exports.filesizeUitl = function (num) {
    if (isNaN(num)) {
        return "";
    }

    return filesizeUitl(num, { base: 2 });
}

function getSep(fp){
    //todo: use path_sep from server
    // this function will take file path/or web url
    // so it need to decide seperator will be used
    let seperator = "/";  //   / is used by linux and web url
    if (fp.match(/[A-Za-z]:\\/)) {
        //match windows path
        seperator = "\\";
    }
    return seperator;
}

const getDir = module.exports.getDir = function (fp) {
    if (!fp) { return ""; }
    const seperator = getSep(fp);
    const tokens = fp.split(seperator);
    return tokens.slice(0, tokens.length - 1).join(seperator);
};

const getBaseName = module.exports.getBaseName = function (fp) {
    if (arguments.length > 1) {
        throw "getBaseName error"
    }

    if (!fp) { return ""; }

    const seperator = getSep(fp);
    const tokens = fp.split(seperator);
    return tokens[tokens.length - 1];
};

module.exports.getFileUrl = function (url) {
    if (!url || url === "NO_THUMBNAIL_AVAILABLE") {
        return "";
    }
  
    // if (url.includes("thumbnails/") || url.includes("cache/") ) {
    //     return "../" + encodeFileUrl(url); 
    // } else {
    return getDownloadLink(url);
    // }
}

const encodeFileUrl = module.exports.encodeFileUrl = function (url) {
    if (!url) {
        return "";
    }
    const ii = url.lastIndexOf('/') + 1;
    const result = url.substring(0, ii) + encodeURIComponent(url.substring(ii));
    return result;
}

const getBaseNameWithoutExtention = module.exports.getBaseNameWithoutExtention = function (fn) {
    if (!fn) {
        return "";
    }
    const tokens = getBaseName(fn).split(".");
    if (tokens.length < 2) {
        return fn;
    } else {
        return tokens.slice(0, tokens.length - 1).join(".");
    }
};

const isIOS = module.exports.isIOS = function () {
    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

const isMobile = module.exports.isMobile = function () {
    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    return /Mobi/.test(navigator.userAgent) && !window.MSStream;
}

module.exports.getPerPageItemNumber = function () {
    if (isMobile()) {
        return 3 * 6;
    } else {
        return 4 * 6;
    }
}

module.exports.sortFileNames = function (files) {
    util._sortFileNames(files, getBaseNameWithoutExtention);
}

module.exports.isLocalHost = function () {
    return location.hostname.includes("localhost");
}

// module.exports.isAuthorized = function (etc_config) {
//     if (location.hostname.includes("localhost")) {
//         return true;
//     } else if(etc_config) {
//         const Cookie = require("js-cookie");
//         const password = Cookie.get('password');
//         return etc_config.remote_file_change_password === password;
//     }
// }

module.exports.isAllowedToEnter = function () {
    return !!Cookie.get('login-token');
}

// module.exports.cleanSearchStr = function(str){
//     // search/ケマオ9% will break everything
//     // it is too troublesome to do everything in url encoding 
//     //FYI, the doujin that make me release this is   (C98) [ケマオ9% (おな丸)] 鹿島とぱっこぱこ・弐 愛情は鹿島の胸に。 (艦隊これくしょん -艦これ-)

//     //  "1233%123123%%".replace(/(%)+$/g, "")   =>  "1233%123123" 
//     return  str && str.replace(/(%)+$/g, "")
// }

module.exports.setSearchInputText = function (text) {
    const input = document.getElementsByClassName('search-input');
    if(input[0]){
        input[0].value = text;
    }  
}

module.exports.getSearchInputText = function () {
    const input = document.getElementsByClassName('search-input');
    return input[0] && input[0].value || "";
}

module.exports.isSearchInputTextTyping = function () {
    const input = document.getElementsByClassName('search-input');
    return input[0] && input[0] === document.activeElement;
}

module.exports.getExplorerLink = function (path) {
    return '/explorer/?p=' + encodeURIComponent(path);
}

module.exports.getSearhLink = function (path) {
    return "/search/?s=" + encodeURIComponent(path);
}

module.exports.getTagLink = function (path) {
    return "/tag/?t=" + encodeURIComponent(path);
}

module.exports.getAuthorLink = function (path) {
    return "/author/?a=" + encodeURIComponent(path);
}

module.exports.getOneBookLink = function (path, index) {
    let temp = "/onebook/?p=" + encodeURIComponent(path);
    index = parseInt(index);
    if(_.isNumber(index)){
        temp += "#index=" + index;
    }
    return temp;
}

module.exports.getOneBookOverviewLink = function (path) {
    return "/onebookOverview/?p=" + encodeURIComponent(path);
}

module.exports.getOneBookWaterfallLink = function (path) {
    return "/onebookWaterfall/?p=" + encodeURIComponent(path);
}

module.exports.getVideoPlayerLink = function (path) {
    return "/videoPlayer/?p=" + encodeURIComponent(path);
}

module.exports.getQuickThumbUrl = function(filePath){
    return "/api/getQuickThumbnail?p=" + encodeURIComponent(filePath);
}

const getDownloadLink = module.exports.getDownloadLink = function (path) {
    if (!path) { return ""; }

    if(path.includes("/api/download/?p")){
       //loadingImage onReceiveUrl
       return path;
    }

    return "/api/download/?p=" + encodeURIComponent(path);
    // let prefix = location.origin.replace(/:\d+/, ":" + userConfig.file_server_port);
    // return prefix + "/api/download/?p=" + encodeURIComponent(path);
}

// function stringHash(str) {
//     const stringHash = require("string-hash");
//     const result = stringHash(str);
//     window.localStorage && window.localStorage.setItem(result, str)
//     return result;
// };

// function getPathFromLocalStorage(hash) {
//     return window.localStorage && window.localStorage.getItem(hash);
// }

// const cookie_expire_days = 5;

// module.exports.saveFilePathToCookie = function (path) {
//     //!!! 413 error. if the cookie become too big
//     const now = util.getCurrentTime();
//     const hash = stringHash(path);
//     Cookie.set(now, hash, { expires: cookie_expire_days })
// }

// const getHistoryCountByFolder = function(){
//     const timeToHash = Cookie.get();
//     const pathes = _.values(timeToHash)
//     .map(hash => {
//         const filePath = getPathFromLocalStorage(hash);
//         return filePath;
//     })
//     .filter(e => !!e)
//     .map(e => {
//         return getDir(e);
//     });

//     return _.countBy(pathes)
// }

// move to backend
// module.exports.getHistoryFromCookie = function () {
//     const timeToHash = Cookie.get();
//     let times = _.keys(timeToHash)
//                  .map(e => parseInt(e))
//                  .filter(e => e && e > 0);
//     times = _.sortBy(times).reverse();

//     const visited = {};
//     const history = [];

//     times.forEach(t => {
//         const hash = timeToHash[t];
//         const filePath = getPathFromLocalStorage(hash);
//         if (visited[filePath] || !filePath) {
//             return;
//         }
//         visited[filePath] = true;
//         try {
//             const time = new Date(+t);
//             history.push([time, filePath])
//         } catch{
//             //cookie may be dirty
//         }
//     });

//     return history;
// }

module.exports.linkFunc = (index)=>{
    const parsed = queryString.parse(location.hash);
    parsed.pageIndex = index + 1;
    const newHash = queryString.stringify(parsed)
    const newUrl = location.href.replace(location.hash, "#" + newHash);
    return newUrl
}

module.exports.replaceUrlHash = function(newHash){
    // console.assert((location.origin + location.pathname + location.search + location.hash) === location.href, "[replaceUrlHash] url error")
    const newUrl = location.href.replace(location.hash, "#" + newHash);
    location.replace(newUrl);
}

function iosCopyToClipboard(el) {
    //https://stackoverflow.com/questions/34045777/copy-to-clipboard-using-javascript-in-ios/34046084
    var oldContentEditable = el.contentEditable,
      oldReadOnly = el.readOnly,
      range = document.createRange();
  
    el.contentEditable = true;
    el.readOnly = false;
    range.selectNodeContents(el);
  
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
  
    el.setSelectionRange(0, 999999); // A big number, to cover anything that could be inside the element.
  
    el.contentEditable = oldContentEditable;
    el.readOnly = oldReadOnly;
  
    document.execCommand('copy');
  }

module.exports.CopyToClipboard = function(text){
    //https://stackoverflow.com/questions/49236100/copy-text-from-span-to-clipboard
    var textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);

    if (isIOS()) {
      iosCopyToClipboard(textArea)
    } else {
      textArea.select();
      document.execCommand("Copy");
    }
    textArea.remove();
}

//https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
module.exports.download = function(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
}

module.exports.setRightAsNext = function(flg){
    console.assert(_.isBoolean(flg));
    window.localStorage && window.localStorage.setItem("isRightAsNext", flg);
}

module.exports.isRightAsNext = function(){
    const item = window.localStorage && window.localStorage.getItem("isRightAsNext");
    const result = !_.isNull(item)? item === 'true' : true;
    console.assert(_.isBoolean(result));
    return result;
}


module.exports.triggerClickOnClass = (className) => {
    // Get all elements with the given class name
    const elements = document.getElementsByClassName(className);

    const arr = Array.from(elements);
    console.assert(arr.length == 1);

    arr[0].click();
}

/**
 * 
 * 这个函数使用scrollBy()方法来将页面滚动指定的像素数。在这里，我们只需要指定垂直滚动的距离，水平滚动距离为0。
 * 参数distance是一个整数，表示向上或向下移动的像素数。当distance为正数时，页面向下滚动；当distance为负数时，页面向上滚动。
 */
module.exports.scrollPageByDistance = (distance) => {
        window.scrollBy(0, distance);
};




const dateFormat = require('dateformat');
/**
 * yyyy-mm-dd HH:MM
 */
module.exports.dateFormat_v1 = (timeStamp) => {
    if(!timeStamp){
        return "-"
    }else{
        return dateFormat(timeStamp, "yyyy-mm-dd HH:MM");
    }
}

module.exports.dateFormat_ymd = (timeStamp) => {
    if(!timeStamp){
        return "-"
    }else{
        return dateFormat(timeStamp, "yyyy-mm-dd");
    }
}


// todo 现在tag也用这个函数。麻烦了。
const author2count  = {};
/** 从arr寻找element，把结果存到缓存。 */
module.exports.getAuthorCount = (authorInfo, author) => {
    if(authorInfo && author){
        if(author2count[author]){
            return author2count[author];
        }

        let result;
        for(let ii = 0; ii < authorInfo.length; ii++){
            const e = authorInfo[ii];
            if(e.tag === author){
                result = e;
                author2count[author] = result;
                break;
            }
        }
        return result;
    }else{
        return null;
    }
}



module.exports.convertSimpleObj2tooltipRow = (obj) => {
    let rows = [];
    if(obj){
        const keys = Object.keys(obj);
        keys.forEach(kk => {
            rows.push([kk, obj[kk]]);
        });
    }
    return rows;
}