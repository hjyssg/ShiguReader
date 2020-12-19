
const serverUtil = require("./serverUtil");
const db = require("./models/db");
const { getFileCollection, getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("./models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const { isImage, isCompress } = util;
const path = require('path');
const _ = require('underscore');
const pfs = require('promise-fs');

// const tf = require('@tensorflow/tfjs-node');
const tf = require('@tensorflow/tfjs-node-gpu');
require('@tensorflow/tfjs-backend-cpu');
// require('@tensorflow/tfjs-backend-webgl');

// tfjs-backend-webgl is JS 
// tfjs-node is cpu 
// tfjs-node-gpu is by gpu 

//https://stackoverflow.com/questions/53231699/converting-png-to-tensor-tensorflow-js
const readImageToTensor = async path => {
    try {
        const imageBuffer = await pfs.readFile(path);
        //https://js.tensorflow.org/api_node/2.8.1/#node.decodeImage 
        const tfimage = tf.node.decodeImage(imageBuffer);
        return tfimage;
    } catch (e) {
        console.warn(e);
        return null;
    }
}

let _model_;

async function init() {
    try {
        //doc website https://js.tensorflow.org/api/0.13.3

        //todo: https://codelabs.developers.google.com/codelabs/tensorflowjs-teachablemachine-codelab/index.html#0
        // create transfer learning based on the original model
        const cocoSsd = require('@tensorflow-models/coco-ssd');
        console.log("loading tensor flow data model...........");
        _model_ = await cocoSsd.load();
        console.log("finished loading tensor flow data model.");
    } catch (e) {
        console.warn(e.message || e);
    }
}

module.exports.isRealPhotoCollection = async function (filePath) {
    let result = false;
    try {
        if (_model_) {
            let pathes = await pfs.readdir(filePath);
            pathes = pathes.filter(isImage).map(e => path.resolve(filePath, e));
            pathes = _.shuffle(pathes);
            // pathes = pathes.slice(0, 5).sort();

            let beg = (new Date).getTime();

            let counter = 0;
            for (let ii = 0; ii < pathes.length; ii++) {
                const pp = pathes[ii];
                let data = await readImageToTensor(pp);
                if (data) {
                    try{
                        const result = await _model_.detect(data);
                        const isPerson = result.findIndex(e => e.class === "person") > -1;
                        // console.log(pp, isPerson);
                        if(isPerson){
                            counter++;
                        }
                    }catch(e){
                        console.warn(e);
                    }
                    
                    if(ii % 50 === 0){
                        let end1 = (new Date).getTime();
                        console.log(ii, `${(end1 - beg) / 1000}s `);
                    }
                }
            }
            result = counter > pathes.length * 0.8;
        }
    } catch (error) {
        debugger
        console.warn(error);
    } finally {
        return result;
    }
}


module.exports.init = init;
