const _ = require('underscore');
const serverUtil = require("../serverUtil");
const db = require("./db");
const { getAllFilePathes, getFileToInfo } = db;
const util = global.requireUtil();
const path = require("path");
const zipInfoDb = require("./zipInfoDb");
const { getZipInfo }  = zipInfoDb;
const pathUtil = require("../pathUtil");
const { isExist,  isDirectParent, isSub } = pathUtil;
const nameParser = require('../../name-parser');
const { useless_tag_regex, getCurrentTime } =  util;

const userConfig = global.requireUserConfig();
const {good_folder_root} = userConfig;

const forest = require("ml-random-forest");
const RFClassifier = forest.RandomForestClassifier;

const not_good_pattern = "D:\\_Happy_Lesson\\_Going_to_sort\\_Compressed";

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
    const zipInfo = getZipInfo([filePath])[filePath];
    const fileInfo = getFileToInfo(filePath);
    const fileTimeA = (fileInfo && fileInfo.mtimeMs) || 0;
    
    let year = new Date(fileTimeA).getFullYear();
    let pageNumber = (zipInfo && zipInfo.pageNum) || 20;

    //naive scaling
    // year = (year - 1970)/100;
    // pageNumber = Math.log10(pageNumber)/3;

    const fileName = path.basename(filePath);
    const result = nameParser.parse(fileName);


    let authorNum = 0;
    let tagNum = 0;

    if(result){
        (result && result.authors||[]).forEach(author => {
            //some author is actually group, fake author
            author = toKey(author);
            authorNum = (authorToFiles[author] || []).length;
        })
    
        result.tags.forEach(tag => {
            if(tag.match(useless_tag_regex)){
              return;
            }
            tag = toKey(tag);
            tagNum = (tagToFiles[tag] || []).length;
        });
    }

    // authorNum /= 100;
    // tagNum = tagNum/100;

    return [pageNumber, year, authorNum, tagNum];
}

const authorToFiles = {};
const tagToFiles = {};

function init(){
    const filePathes = getAllFilePathes().filter(util.isCompress)
    .filter(e => {
        return isSub(good_folder_root, e) || e.startsWith(not_good_pattern);
    });

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

    var trainingSet = new Array();
    var predictions = new Array();

    //going to generate training date
    const kk = 10000;
    const sets = _.shuffle(filePathes).slice(0, kk);
    sets.forEach(filePath =>{
        const feature = getFeature(filePath);
        // console.log(feature);

        const isGood = isSub(good_folder_root, filePath);
        const y = isGood? 1: 0;

        trainingSet.push(feature);
        predictions.push(y);
    });

    var options = {
        seed: 2,
        maxFeatures: 0.8,
        replacement: true,
        nEstimators: 25
      };
    
    console.log("-----machine learning----")
    const beginTime = getCurrentTime();

    const by = require('ml-naivebayes');
    var classifier = new by.GaussianNB();

    // var classifier = new RFClassifier(options);
    classifier.train(trainingSet, predictions);


    const timeSpent = getCurrentTime() - beginTime;
    console.log(timeSpent, "to train for", kk, "data");

    const GOOD_STANDARD = 2;
    const tt = 50;
    let naivecount = 0;
    let count = 0;
    for(let ii = 0; ii < tt; ii++){
        const index = Math.floor(Math.random() * kk);
        const x = trainingSet[index];
        const expected = predictions[index];

        let result = classifier.predict([x]);
        if(result[0] === expected ){
            count++;
        }

        const fp = sets[index];
        const fn = path.basename(fp);
        result = nameParser.parse(fn);
        let guess = false;
        if (result) {
            (result.authors||[]).forEach(author => {
              //some author is actually group, fake author
              author = toKey(author);
              if(!groupSet[author]){
                guess = authorToFiles[author].length > GOOD_STANDARD? 1: 0;
              }
            })
        }

        if(guess === expected){
            naivecount++;
        }
    }

    console.log(count, "/", tt);
    console.log(naivecount, "/", tt);

}

function demo(){
    const IrisDataset = require('ml-dataset-iris');

    var trainingSet = IrisDataset.getNumbers();
    var predictions = IrisDataset.getClasses().map((elem) =>
    IrisDataset.getDistinctClasses().indexOf(elem)
    );

    var options = {
        seed: 3,
        maxFeatures: 0.8,
        replacement: true,
        nEstimators: 25
      };
      
      var classifier = new RFClassifier(options);
      classifier.train(trainingSet, predictions);
      var result = classifier.predict(trainingSet);
    //   console.log(result);

}



module.exports.init = init;
