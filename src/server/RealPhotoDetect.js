
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getFileCollection, getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const { escapeRegExp } = util;
const path = require('path');
const _ = require('underscore');

async function init(){
    try {

        const cocoSsd = require('@tensorflow-models/coco-ssd');
        require('@tensorflow/tfjs-backend-cpu');
        require('@tensorflow/tfjs-backend-webgl');

         // Load the model.
        const model = await cocoSsd.load();

    }catch(e){
        console.warn(e);
    }
}

module.exports = init;
