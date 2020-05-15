const util = require("../util");

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

module.exports.getUrl = function (url){
    return "../" + encodeFileUrl(url);
}

const encodeFileUrl = module.exports.encodeFileUrl = function(url){
    const ii = url.lastIndexOf('/')+1;
    const result =  url.substring(0, ii) + encodeURIComponent(url.substring(ii));
    return result;
}

const getBaseNameWithoutExtention = function (fn, seperator) {
    seperator = seperator || "/"
    if (!fn) { return ""; }
    return getBaseName(fn, seperator).split(".")[0];
};

const isPad = module.exports.isPad = function(){
    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

module.exports.getPerPageItemNumber = function() {
    if(isPad()){
        return 3 * 6;
    }else{
        return 4 * 5;
    }
}

module.exports.stringHash = function (str) {
    const stringHash = require("string-hash");
    const  result = stringHash(str);
    window.localStorage && window.localStorage.setItem(result, str)
    return result;
};

module.exports.getPathFromLocalStorage = function(hash){
    return window.localStorage && window.localStorage.getItem(hash);
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
        const userConfig = require('../user-config');
        const password =  Cookie.get('password');
        return userConfig.file_change_password === password;
    }
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
    return '/explorer/?p='+ path;
}

module.exports.getSearhLink = function(path){
    return"/search/?s=" + path;
}

module.exports.getTagLink = function(path){
    return"/tag/?t=" + path;
}

module.exports.getAuthorLink = function(path){
    return"/author/?a=" + path;
}