const _ = require('underscore');
const serverUtil = require("../serverUtil");
const db = require("./db");
const { getAllFilePathes, getFileToInfo } = db;
const path = require("path");
const pathUtil = require("../pathUtil");
const { isSub } = pathUtil;
const nameParser = require('../../name-parser');
const util = global.requireUtil();
const { useless_tag_regex, getCurrentTime } =  util;
const userConfig = global.requireUserConfig();
const { good_folder_root, not_good_folder_root} = userConfig;

// const forest = require("ml-random-forest");
// const RFClassifier = forest.RandomForestClassifier;
//random forest training is so slow
// #data	 time in ms
// 1000	  2000
// 1500	  5331
// 2500	  12999
// 3000	  18535
// 4000	  35000

//svm莫名其妙output只有一种
//调参数 太麻烦 需要回头看书研究

function toKey(str){
    return str.toLowerCase().replace(/-| |\!/, "");
    //or the search will be wrong
}

function addToArray(table, key, value){
    if(!key || !value){
        return;
    }
    if (!table[key]) {
        table[key] = [value];
    } else {
        table[key].push(value);
    }
}

function getFeature(filePath){
    const fileName = path.basename(filePath);
    const fileInfo = getFileToInfo(filePath);
    const fileTimeA = (fileInfo && fileInfo.mtimeMs) || 0;
    let aboutTimeA = nameParser.getDateFromParse(fileName);
    aboutTimeA = aboutTimeA && aboutTimeA.getTime();
    let year = new Date(aboutTimeA || fileTimeA).getFullYear();

    // page number is not related
    // 算法特别重视页数，但实际页数是很不重要的参数

    const result = nameParser.parse(fileName);

    let authorNum = 0;
    let tagNum = 0;
    
    if(result){
        //特征值的选取和个人喜好关系很大
        //需要参考自己的经验
        (result && result.authors||[]).forEach(author => {
            //some author is actually group, fake author
            author = toKey(author);
            let subfiles = authorToFiles[author] || [];
            const goods = getSubInGoodRoot(subfiles).length;
            const normal =  subfiles.length - goods;
            authorNum = Math.max((goods * 10 + normal), authorNum);
        })
    
        result.tags.forEach(tag => {
            if(tag.match(useless_tag_regex)){
              return;
            }
            tag = toKey(tag);
            let subfiles = tagToFiles[tag] || [];
            let goods = getSubInGoodRoot(subfiles);
            tagNum = Math.max(goods.length, tagNum);
        });
    }

    return [year].concat(authorNum, tagNum);
}

const authorToFiles = {};
const tagToFiles = {};

const MIN_FILES_FOR_INIT = 5000;
const _GOOD = 1;
const _NOT_GOOD = 0;
let bayes;
let min_row = [];
let max_row = [];

function linearScale(feature){
    return feature.map((val, ii) => {
        return (val - min_row[ii])/(max_row[ii] - min_row[ii])
    })
}

function init(){
    const filePathes = getAllFilePathes().filter(util.isCompress)
    .filter(e => {
        return isSub(good_folder_root, e) || isSub(not_good_folder_root, e);
    });

    if(filePathes.length < MIN_FILES_FOR_INIT){
        return;
    }

    const groupSet = {};

    filePathes.forEach(filePath =>{
        const fileName = path.basename(filePath);
        const result = nameParser.parse(fileName);
        if (result && result.group) {
          const group = toKey(result.group);
          groupSet[group] = true;
        }
    })
    
    filePathes.forEach(filePath =>{
        const fileName = path.basename(filePath);
        const result = nameParser.parse(fileName);
        if (result) {
            (result.authors||[]).forEach(author => {
              //some author is actually group, fake author
              author = toKey(author);
              if(!groupSet[author]){
                addToArray(authorToFiles, author, filePath );
              }
            })

            result.tags.forEach(tag => {
              if(tag.match(useless_tag_regex)){
                return;
              }
              tag = toKey(tag);
              addToArray(tagToFiles, tag, filePath);
            });
        }
    });

    var inputSet = new Array();
    var outputSet = new Array();

    //going to generate training date
    const sets = _.shuffle(filePathes);
    sets.forEach(filePath =>{
        const feature = getFeature(filePath);

        const isGood = isSub(good_folder_root, filePath);
        const y = isGood? _GOOD: _NOT_GOOD;

        inputSet.push(feature);
        outputSet.push(y);
    });

    inputSet.forEach((row) => {
        row.forEach((col, jj) =>{
            let min = min_row[jj] || Infinity;
            let max = max_row[jj] || -Infinity;
            min_row[jj] = Math.min(col, min);
            max_row[jj] = Math.max(col, max);
        })
    })
 
    inputSet = inputSet.map(row=> linearScale(row))
    console.log("-----machine learning---------")
    const beginTime = getCurrentTime();

    const totalLength = inputSet.length;
    const valid_length = 50;
    const sep = totalLength - valid_length;
    const trainingSet = inputSet.slice(0, sep);
    const trainingOutput = outputSet.slice(0, sep);

    //    "ml-naivebayes": "^4.0.0",
    const by = require('ml-naivebayes');
    bayes = new by.GaussianNB();
    bayes.train(trainingSet, trainingOutput);

    const timeSpent = getCurrentTime() - beginTime;
    console.log(`${timeSpent}ms to train for ${trainingSet.length} data`);


    //do the validation
    const GOOD_STANDARD = 1;
    let naivecount = 0;
    let count = 0;

    const validInput = inputSet.slice(sep);
    const validOutput = outputSet.slice(sep);
    const validFilePathes =  sets.slice(sep);
    for(let ii = 0; ii < validInput.length; ii++){
        const x = validInput[ii];
        const expected = validOutput[ii];
        const fp = validFilePathes[ii];
        const fn = path.basename(fp);

        let result = bayes.predict([x]);
        if(result[0] === expected ){
            count++;
        }
        
        result = nameParser.parse(fn);
        let guess = false;
        if (result) {
            (result.authors||[]).forEach(author => {
                //some author is actually group, fake author
               author = toKey(author);
                if(!groupSet[author]){
                    let subfiles = authorToFiles[author] || [];
                    subfiles = getSubInGoodRoot(subfiles);
                    guess = subfiles.length > GOOD_STANDARD? _GOOD: _NOT_GOOD;
                }
            })
        }

        if(guess === expected){
            naivecount++;
        }
    }

    console.log(`naivebayes accuracy: ${count/validInput.length*100}%`);
    console.log(`good_folder_root algo  accuracy: ${naivecount/validInput.length*100}%`);
}

function getSubInGoodRoot(filePathes){
    return filePathes.filter(e => isSub(good_folder_root, e))
}

function guessIfUserLike(filePathes){
    const result = {};
    //https://github.com/hjyssg/ShiguReader/issues/81 
    //也不说怎么重现。下次我想收钱
    try{
        filePathes.forEach(e => {
            if(util.isCompress(e)){
                const feature = linearScale(getFeature(e));
                const prediction = bayes.predict([feature])[0];
                if(prediction === _GOOD){
                    result[e] = true;
                }
            }
        })
    }catch(e){

    }finally{
        return result;
    }
}

serverUtil.common.guessIfUserLike = guessIfUserLike;

module.exports.init = init;
