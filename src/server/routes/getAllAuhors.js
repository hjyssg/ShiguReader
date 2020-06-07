const express = require('express');
const router = express.Router();
const searchByTagAndAuthor = require("../models/search");
const db = require("../models/db");
const { getAllFilePathes } = db;
const util = global.requireUtil();
const path = require("path");
const nameParser = require('../../name-parser');

// three para 1.mode 2.text
router.post("/api/getAllAuthors", (req, res) => {

    const pathes =  getAllFilePathes().filter(util.isCompress);
    const groupSet = {};
    pathes.forEach(filePath => {
        const fileName = path.basename(filePath);
        const result = nameParser.parse(fileName);
        if (result && result.group) {
            groupSet[result.group] = true;
        }
    })
    
    const authorSets = {};
    pathes.forEach(filePath => {
        const fileName = path.basename(filePath);
        const result = nameParser.parse(fileName);
        if (result) {
            (result.authors||[]).forEach(author => {
                //some author is actually group, fake author
                if(!groupSet[author]){
                authorSets[author] = true;
                }
            })
        }
    })

    const authors = _.keys(authorSets);
    const authorTable = {};

    authors.forEach(author => {
        authorTable[author] = searchByTagAndAuthor("", author, "");
    })

    // res.send
});

module.exports = router;
