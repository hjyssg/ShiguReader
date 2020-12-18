
const serverUtil = require("./serverUtil");
const db = require("./models/db");
const { getFileCollection, getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("./models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const { isImage, isCompress} = util;
const path = require('path');
const _ = require('underscore');
const pfs = require('promise-fs');

const tf = require('@tensorflow/tfjs-node');
require('@tensorflow/tfjs-backend-cpu');
require('@tensorflow/tfjs-backend-webgl');


//https://stackoverflow.com/questions/53231699/converting-png-to-tensor-tensorflow-js
const readImageToTensor = async path => { 
    try{
        const imageBuffer = await pfs.readFile(path);     
        //https://js.tensorflow.org/api_node/2.8.1/#node.decodeImage 
        const tfimage = tf.node.decodeImage(imageBuffer);
        return tfimage;   
    } catch(e){
        console.warn(e);
        return null;
    }   
}

let _model_;

async function init(){
    try {
        //doc website https://js.tensorflow.org/api/0.13.3

        //todo: https://codelabs.developers.google.com/codelabs/tensorflowjs-teachablemachine-codelab/index.html#0
        // create transfer learning based on the original model
        const cocoSsd = require('@tensorflow-models/coco-ssd');
        console.log("loading tensor flow data model...........");
        _model_ = await cocoSsd.load();
        console.log("finished loading tensor flow data model.");
    }catch(e){
        console.warn(e.message || e);
    }
}

module.exports.isRealPhotoCollection = async function (filePath){
    try {
        if(_model_){
            let pathes = await pfs.readdir(filePath);
            pathes = pathes.filter(isImage).map(e => path.resolve(filePath, e));
            pathes =  _.shuffle(pathes);
            pathes = pathes.slice(0, 5).sort();

            for(let ii = 0; ii < pathes.length; ii++){
                const pp = pathes[ii];
                let data = await  readImageToTensor(pp);
                if(data){
                    const result = await _model_.detect(data);
                    const personIndex = result.findIndex(e => e.class === "person")
                    console.log(pp, personIndex > -1 );
                }
            }
        }  
    } catch (error) {
        debugger
        console.warn(error);
    }
}


module.exports.init = init;
