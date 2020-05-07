const config = require("./jp-family-name");
let family_names = config.family_names;
let name_entris = config.name_entris;

function getContainSubstring(strArr, str){
    let result;
    strArr.some(entry => {
        if(str.includes(entry)){
            result = entry;
        }
    });
    return result;
}

const localCache = {};
function parse(str) {
    if (!str || localCache[str] === "NO_EXIST") {
      return null;
    }

    if(localCache[str]){
        return localCache[str];
    }

    let result = [];
    //split by space english letter, digital number and punctuation
    //I dont use NLP library, because 
    //1.their size is too big
    //2. they cut a fullname into last name and meaningless substr
    let tokens = str.split(/[ \dA-Za-z.,\/#!$%\^&\*;:{}=\-_`~()\[\]\–-、｀～？！、。「」；’：｜＝＋]/).filter(e => !!e);
    tokens.forEach(tt => {
        const nameEntry = getContainSubstring(name_entris, tt);
        if(nameEntry){
            result.push(nameEntry);
        }else{
            let familyName = getContainSubstring(family_names, tt);
            //check the substring
            const firstName = tt.replace(familyName, "");
            if(firstName.length > 4){
                familyName = false;
            }
            if(familyName){
                result.push(tt);
            }
        }
    })

    if(result.length === 0){
        localCache[str] = "NO_EXIST";
        result = null;
    }else{
        localCache[str] = result;
    }
    return result;
}

module.exports.parse = parse;