const config = require("./jp-family-name");
let family_names = config.family_names;
let name_entris = config.name_entris;

//https://stackoverflow.com/questions/5582574/how-to-check-if-a-string-contains-text-from-an-array-of-substrings-in-javascript
const name_regex = new RegExp(name_entris.join("|"));

const family_name_regex = new RegExp(family_names.join("|"));


const localCache = {};
function pick(str) {
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
    const sep = /[ \dA-Za-z.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋]/;
    let tokens = splitBySpace(str, sep);
    tokens.forEach(tt => {
        const nameEntry = tt.match(name_regex);
        // const nameEntry = getContainSubstring(name_entris, tt);
        if(nameEntry){
            nameEntry.forEach(e => {
                result.push(e);
            })
        }else{
            let familyName = tt.match(family_name_regex);
            if(familyName && familyName.index === 0){
                familyName.forEach(e => {
                    //check the substring
                    const firstName = tt.replace(familyName, "");
                    if(firstName.length < 4){
                        result.push(tt);
                    }
                })
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

const splitBySpace = module.exports.splitBySpace = function(str, sep) {
    sep = sep || /[ \.,\/#!$%\^&＆\*;:{}=\-_`~()\[\]\–-、｀～？！＠@、。／『』「」；’：・｜＝＋]/;
    return str.split(sep).filter(e => !!e)
}
module.exports.pick = pick;