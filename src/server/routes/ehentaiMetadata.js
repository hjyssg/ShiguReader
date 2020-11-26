const util = global.requireUtil();
const { escapeRegExp } = util;
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const path = require('path');


const jsonfile = require('jsonfile');
const loki = require("lokijs");
const ehentai_db = new loki();
const ehentai_collection = ehentai_db.addCollection("ehentai_metadata", { 
    // indices: ["fileName", "tags", "authors"],
    // unique: ['filePath'] 
});

/**
 * return obj will have:
 * title, title_jpn, category, fileCount, parody, character, group, artist, female, male, _raw_tag
 */
function extractEntry(entry){
  //a lot info in each metadata
  //we do not need all to waste RAM
  let meaningfulKey = [
    "title",
    "title_jpn",
    "category",
    "fileCount",
    "tags"
  ];

  const result = {};
  for(let key in entry){
    if( meaningfulKey.includes(key) &&  entry.hasOwnProperty(key)){
      
      if(key === "tags"){
        const tags = entry[key];
        //e.g tags 
        // parody:pangya
        // character:kooh
        // group:arisan-antenna
        // artist:koari
        // female:catgirl
        // female:gymshorts
        // female:kemonomimi
        // female:lolicon
        // female:twintails

        tags.forEach(e => {
          const tokens = e.split(":").map(e => e.trim());
          const subkey = tokens[0];
          const subvalue = tokens[1];

          result[subkey]= result[subkey] || [];
          result[subkey].push(subvalue)
        });

        result._raw_tags = tags.join(";")
      }else{
        result[key] = entry[key];
      }
    }
  }

  return result;
}

async function readJson(filePath){
  try{
    if(!(await isExist(filePath))){
        return;
    }

    let obj = await jsonfile.readFile(filePath)

    let ii = 0;
    for(let key in obj){
      if(obj.hasOwnProperty(key)){
        //each valur represent one file
        const entry = extractEntry(obj[key]);
        ehentai_collection.insert(entry)
        ii++;
      }
    } 
  }catch(error){
    console.error(error)
  }finally{
    //release memory
    obj = null;
  }
}


// https://github.com/firefoxchan/local-ehentai/blob/master/README-zh.md
const rootPath = path.join(__dirname, "..", "..", "..");
const _file_ =  path.join(rootPath, "gdata.json");
readJson(_file_);


//--------------------------------------------------------------


function searchOneBook (searchWord){
  const reg = escapeRegExp(searchWord);
  let sResults = ehentai_collection
                .chain()
                .find({'title_jpn': { '$regex' : reg }})
                // .where(obj => isSub(dir, obj.filePath))
                .data();
  console.log(sResults);
}

router.post('/api/getEhentaiMetaData', async (req, res) => {
    let filePath = req.body && req.body.filePath;

    if (!filePath) {
        res.sendStatus(404);
        return;
    }

    const sResult = searchOneBook(searchWord)
    if(!sResult){
      res.sendStatus(404)
    }else{
      res.send(sResult);
    }
});

//this search combine into exist tag search
function searchByTag(tag){
    const reg = escapeRegExp(tag);
    let sResults = ehentai_collection
    .chain()
    .find({'_raw_tags': { '$regex' : reg }})
    // .where(obj => isSub(dir, obj.filePath))
    .data(); 
  
  
    //only return file really in the local hdd
    console.log(sResults);
}

module.exports = router;
