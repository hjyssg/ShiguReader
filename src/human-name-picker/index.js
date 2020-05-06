const family_names = require("./jp-family-name").family_names;
const util = require("../util");

const localCache = {};

function parse(str) {
    if (!str || localCache[str] === "NO_EXIST") {
      return null;
    }

    if(localCache[str]){
        return localCache[str];
    }

    let result = [];
    let tokens = str.split(/[ \dA-Za-z.,\/#!$%\^&\*;:{}=\-_`~()\[\]\–-、｀～？！、。「」；’：｜＝＋]/).filter(e => !!e);
    tokens.forEach(tt => {
        let hasfamilyName;
        
        family_names.some(family_name => {
            if(tt.includes(family_name)){
                hasfamilyName = family_name;
            }
        });

        //check the substring
        const firstName = tt.replace(hasfamilyName, "");

        if(firstName.length > 4){
            hasfamilyName = false;
        }

        if(hasfamilyName){
            result.push(tt);
        }
    })

    if(result.length === 0){
        result = "NO_EXIST";
    }

    localCache[str] = result;
    return result;
}

module.exports.parse = parse;