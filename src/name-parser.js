'use strict';

var _ = require("underscore");
var pReg = "\\((.*?)\\)";
var bReg = "\\[(.*?)\\]";
var s = "\\s*";
var feReg = "\\..*$";
var fullRegs = [];

//e.g  [真珠貝] マナタマプラス .zip
fullRegs[0] = new RegExp( bReg + s + "(.*?)" + s + feReg);

//e.g [真珠貝] マナタマプラス (ラブプラス).zip
fullRegs[1] = new RegExp( bReg + s + "(.*?)" + s + pReg + feReg);

var authorReg = /\[(.*)\((.*)\)\]/;

function getAuthorName(str){
    var macthes = str.match(/(.*?)\s*\((.*?)\)/);
    if(macthes && macthes.length > 0){
        return {
            group: macthes[1].trim(),
            name: macthes[2].trim(),
            isDoujin: true
        };
    }else{
        return {
            name: str.trim(),
            isDoujin:false
        };
    }
}


function parse(str, config){
    if(!str){
      return null;
    }

    for (var i = fullRegs.length - 1; i >= 0; i--) {
        var macthes = str.match(fullRegs[i]);
        if(macthes && macthes.length > 0){
            var result = {};
            result.author = getAuthorName(macthes[1]);
            result.isDoujin = result.author.isDoujin;
            result.title = macthes[2].trim();
            if(i == 1){
              result.tag = macthes[3].trim();
            }

            var prefix = str.replace(macthes[0], "");
            var tags = prefix.match(/\((.*?)\)/g)
            if(tags && tags.length > 0){
                result.extra = tags;
                result.extra = _.map(result.extra, function(e){
                                                            return e.trim().replace(/^\(/, "").replace(/\)$/, "")
                                                        });
            }
            return result;
        }
    }
    return null;
}

module.exports.parse = parse;
