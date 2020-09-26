const util = require("@common/util");
const Cookie = require("js-cookie");
const _ = require("underscore");
const filesizeUitl = require('filesize');

module.exports.filesizeUitl = function(num){
    if(isNaN(num)){
        return "";
    }

    return filesizeUitl(num, {base: 2});
}

module.exports.getDir = function (fn) {
    if (!fn) { return ""; }
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

// '\' is for browser path
const getBaseName = module.exports.getBaseName = function (fn, seperator) {
    if (!fn) { return ""; }
    const tokens = seperator? fn.split(seperator) : fn.split('\\');
    return tokens[tokens.length - 1];
};

module.exports.getFileUrl = function (url){
    return "../" + encodeFileUrl(url);
}

const encodeFileUrl = module.exports.encodeFileUrl = function(url){
    if(!url){
        return "";
    }
    const ii = url.lastIndexOf('/')+1;
    const result =  url.substring(0, ii) + encodeURIComponent(url.substring(ii));
    return result;
}

const getBaseNameWithoutExtention = module.exports.getBaseNameWithoutExtention = function (fn, seperator) {
    seperator = seperator || "/"
    if (!fn) { return ""; }
    return getBaseName(fn, seperator).split(".")[0];
};

module.exports.isIOS = function(){
    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

const isMobile = module.exports.isMobile = function(){
    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    return /Mobi/.test(navigator.userAgent) && !window.MSStream;
}

module.exports.getPerPageItemNumber = function() {
    if(isMobile()){
        return 3 * 6;
    }else{
        return 4 * 5;
    }
}

module.exports.sortFileNames = function(files){
    util._sortFileNames(files, getBaseNameWithoutExtention);
}

module.exports.isLocalHost = function(){
    return location.hostname.includes("localhost");
}

module.exports.isAuthorized = function(){
    if(location.hostname.includes("localhost")){
        return true;
    }else{
        const Cookie = require("js-cookie");
        const userConfig = require('@config/user-config');
        const password =  Cookie.get('password');
        return userConfig.file_change_password === password;
    }
}

module.exports.isAllowedToEnter = function(){
    const userConfig = require('@config/user-config');
    if(!userConfig.home_password){
        return true;
    }

    const Cookie = require("js-cookie");
    const password =  Cookie.get('home-password');
    return userConfig.home_password === password;
}

// module.exports.cleanSearchStr = function(str){
//     // search/ケマオ9% will break everything
//     // it is too troublesome to do everything in url encoding 
//     //FYI, the doujin that make me release this is   (C98) [ケマオ9% (おな丸)] 鹿島とぱっこぱこ・弐 愛情は鹿島の胸に。 (艦隊これくしょん -艦これ-)

//     //  "1233%123123%%".replace(/(%)+$/g, "")   =>  "1233%123123" 
//     return  str && str.replace(/(%)+$/g, "")
// }

module.exports.getSearchInputText = function(){
    const input = document.getElementsByClassName('search-input');
    return input[0] && input[0].value || "";
}

module.exports.isSearchInputTextTyping = function(){
    const input = document.getElementsByClassName('search-input');
    return input[0] && input[0] === document.activeElement;
}

module.exports.getExplorerLink = function(path){
    return '/explorer/?p='+ encodeURIComponent(path);
}

module.exports.getSearhLink = function(path){
    return"/search/?s=" + encodeURIComponent(path);
}

module.exports.getTagLink = function(path){
    return"/tag/?t=" + encodeURIComponent(path);
}

module.exports.getAuthorLink = function(path){
    return"/author/?a=" + encodeURIComponent(path);
}

module.exports.getOneBookLink = function(path){
    return "/onebook/?p=" + encodeURIComponent(path);
}

module.exports.getVideoPlayerLink = function(path){
    return "/videoPlayer/?p=" + encodeURIComponent(path);
}

module.exports.getDownloadLink = function(path){
    return "/api/download/?p=" + encodeURIComponent(path);
}

function stringHash (str) {
    const stringHash = require("string-hash");
    const  result = stringHash(str);
    window.localStorage && window.localStorage.setItem(result, str)
    return result;
};

function getPathFromLocalStorage(hash){
    return window.localStorage && window.localStorage.getItem(hash);
}

const cookie_expire_days = 5;

module.exports.saveFilePathToCookie = function(path){
        //!!! 413 error. if the cookie become too big
        const now = util.getCurrentTime();
        const hash = stringHash(path);
        Cookie.set(now, hash, { expires: cookie_expire_days })
}

module.exports.getHistoryFromCookie = function(){
    const timeToHash = Cookie.get();
    let times = _.keys(timeToHash);
    times = _.sortBy(times);

    const visited = {};
    const history = [];
    
    times.forEach(t => {
        const hash =  timeToHash[t];
        const filePath = getPathFromLocalStorage(hash);
        if(visited[filePath] || !filePath){
            return;
        }
        visited[filePath] = true;
        try{
            const time = new Date(+t);
            history.push([time, filePath])
        }catch{
            //cookie may be dirty
        }
    });

    return history;
}