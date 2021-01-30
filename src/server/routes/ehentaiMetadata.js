const util = global.requireUtil();
const { escapeRegExp } = util;
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const path = require('path');

const serverUtil = require("../serverUtil");
const parse = serverUtil.parse;

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
function extractEntry(entry) {
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
  for (let key in entry) {
    if (meaningfulKey.includes(key) && entry.hasOwnProperty(key)) {

      if (key === "tags") {
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

          result[subkey] = result[subkey] || [];
          result[subkey].push(subvalue)
        });

        result._raw_tags = tags.join(";")
      } else {
        result[key] = entry[key];
      }
    }
  }

  return result;
}

async function readJson(filePath) {
  let end1 = (new Date).getTime();
  try {
    return;
    if (!(await isExist(filePath))) {
      return;
    }

    let obj = await jsonfile.readFile(filePath)

    let ii = 0;
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        //each valur represent one file
        const entry = extractEntry(obj[key]);
        ehentai_collection.insert(entry)
        ii++;
        if (ii % 10000 === 0) {
          console.log("[ehentaiMetadata] loading:", ii);
        }
      }
    }

    //这个和file collection进行join的key标注？

  } catch (error) {
    console.error(error)
  } finally {
    //release memory
    obj = null;
    let end3 = (new Date).getTime();
    console.log("[ehentaiMetadata] number of entries in database :", ehentai_collection.count())
    console.log(`${(end3 - end1) / 1000}s to load ehentai database`);
  }
}


// https://github.com/firefoxchan/local-ehentai/blob/master/README-zh.md
const rootPath = path.join(__dirname, "..", "..", "..");
const _file_ = path.join(rootPath, "gdata.json");
readJson(_file_);


//--------------------------------------------------------------


function searchOneBook(searchWord) {
  let reg, sResults;

  reg = escapeRegExp(searchWord);
  sResults = ehentai_collection
    .chain()
    .find({ 'title_jpn': { '$regex': reg } })
    .data();

  if (!sResults || sResults.length === 0) {
    const parseObj = parse(searchWord);
    if (parseObj && parseObj.author) {
      reg = escapeRegExp(parseObj.author);
      sResults = ehentai_collection
        .chain()
        .find({ 'title_jpn': { '$regex': reg } })
        .where(obj => {
          if (obj['title_jpn'].includes(parseObj.title)) {
            return true;
          }
        })
        .data();
    }
  }

  if (sResults && sResults.length > 0) {
    return sResults;
  }
}

router.post('/api/getEhentaiMetaData', async (req, res) => {
  let filePath = req.body && req.body.filePath;

  if (!filePath) {
    res.send({ failed: true, reason: "No parameter" });
    return;
  }

  const searchWord = path.basename(filePath, path.extname(filePath));
  const sResult = searchOneBook(searchWord)
  if (!sResult) {
    res.send({ failed: true, reason: "NOT FOUND" })
  } else {
    res.send(sResult);
  }
});

//this search combine into exist tag search
global.searchByTag = function (tag) {
  //todo: this algo is draft, need to improve
  const reg = escapeRegExp(tag);
  let sResults = ehentai_collection
    .chain()
    .find({ '_raw_tags': { '$regex': reg } })
    // .where(obj => isSub(dir, obj.filePath))
    .data();
  return sResults;
}

module.exports = router;
