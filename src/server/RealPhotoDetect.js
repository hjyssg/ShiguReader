
const serverUtil = require("./serverUtil");
const db = require("./models/db");
const { getFileCollection, getImgFolderInfo } = db;
const parse = serverUtil.parse;
const zipInfoDb = require("./models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const util = global.requireUtil();
const { escapeRegExp } = util;
const path = require('path');
const _ = require('underscore');

const tf = require('@tensorflow/tfjs-node');
require('@tensorflow/tfjs-backend-cpu');
require('@tensorflow/tfjs-backend-webgl');





//https://stackoverflow.com/questions/53231699/converting-png-to-tensor-tensorflow-js
const imageGet = require('get-image-data');
async function loadLocalImage(filename) {
//     return new Promise((res,rej)=>{
//         imageGet(filename, (err, info) => {
//             if(err){
//                 rej(err);
//                 return;
//             }
//             debugger
//             // const image = tf.browser.fromPixels(info.data);
//             // var buf32 = new Uint32Array(info.data);

//             // info.data = buf32;

//             const image = tf.browser.fromPixels(info)
//             //   console.log(image, '127');
//             res(image);
//         });
//    });
}

const { createCanvas, loadImage } = require('canvas');

const canvas = createCanvas(200, 200)
const ctx = canvas.getContext('2d');

loadImage('F:\\tf_learning\\2.jpg').then((image) => {
    ctx.drawImage(image, 50, 0, 70, 70)

    image2 = tf.browser.fromPixels(ctx)


    // console.log('<img src="' + canvas.toDataURL() + '" />')


    

})

// loadLocalImage('F:\\tf_learning\\2.jpg');

async function init(){
    try {
        // var getImage = require('get-image-data');
        // const _util = require('util');
        // const getImageAsync = _util.promisify(getImage);

        //doc website https://js.tensorflow.org/api/0.13.3/#fromPixels

        //todo: https://codelabs.developers.google.com/codelabs/tensorflowjs-teachablemachine-codelab/index.html#0
        //  I transfer learning the original model
        const cocoSsd = require('@tensorflow-models/coco-ssd');
        

        // Looks like you are running TensorFlow.js in Node.js. To speed things up dramatically, install our node backend, which binds to TensorFlow C++, by running npm i @tensorflow/tfjs-node, or npm i @tensorflow/tfjs-node-gpu if you have CUDA. Then call require('@tensorflow/tfjs-node'); (-gpu suffix for CUDA) at the start of your program. Visit https://github.com/tensorflow/tfjs-node for more details.

         // Load the model.

        console.log("loading tensor flow data model...........");
        const model = await cocoSsd.load();
        console.log("finished loading tensor flow data model.");

        // const  data = await getImageAsync('F:\\tf_learning\\2.jpg');
        let data = await loadLocalImage('F:\\tf_learning\\2.jpg');

        const result = await model.detect(data);

        debugger
        console.log(result)

    }catch(e){
        debugger
        console.warn(e.message || e);
    }
}

module.exports.init = init;
