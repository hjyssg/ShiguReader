// ABANDON  废弃文件
// const express = require('express');
// // const app = express();
// const userConfig = global.requireUserConfig();
// const stringHash = require("string-hash");
// const pfs = require('promise-fs');
// const path = require('path');

// const util = global.requireUtil();
// const { isImage, isGif } = util;

// const pathUtil = require("./pathUtil");
// const { isExist } = pathUtil;
// const memorycache = require('memory-cache');

// // async function init() {
// //     const port = userConfig.file_server_port;
// //     const server = app.listen(port, async () => {
// //         console.log("[file server] on ", port)
// //     }).on('error', (error) => {
// //         console.error("[file server]", error.message);
// //         process.exit(22);
// //     });
// // }




// let sharp;
// try {
//     sharp = require('sharp')
// } catch (e) {
//     console.error("did not install sharp", e);
// }
// const THUMBNAIL_HUGE_THRESHOLD = 2 * 1000 * 1000;
// const ONEBOOK_HUGE_THRESHOLD = 3 * 1000 * 1000;


// const router = express.Router();

// //------------------download------------
// router.get('/api/download/', async (req, res) => {
//     let filePath = path.resolve(req.query.p);
//     let thumbnailMode = req.query.thumbnailMode;
//     if (!filePath) {
//         console.error("[/api/download]", filePath, "NO Param");
//         res.send({ failed: true, reason: "NO Param" });
//         return;
//     }


//     if (!(await isExist(filePath))) {
//         console.error("[/api/download]", filePath, "NOT FOUND");
//         res.send({ failed: true, reason: "NOT FOUND" });
//         return;
//     }

//     try {
//         if (sharp && isImage(filePath) && !isGif(filePath)) {
//             if(memorycache.get(filePath)){
//                 filePath = memorycache.get(filePath);
//             }else{
//                 const stat = await pfs.stat(filePath);
//                 // mimize as thumbnail
//                 if (thumbnailMode && stat.size > THUMBNAIL_HUGE_THRESHOLD) {
//                     const outputFn = stringHash(filePath).toString() + "-min.webp";
//                     const outputPath = path.resolve(global.cachePath, outputFn);
//                     if (!(await isExist(outputPath))) {
//                         await sharp(filePath).resize({ height: 280 }).toFile(outputPath);
//                     }
//                     memorycache.put(filePath, outputPath, 60*1000);
//                     filePath = outputPath;
//                 }else if(stat.size > ONEBOOK_HUGE_THRESHOLD){
//                     // shrink huge img
//                     const outputFn = stringHash(filePath).toString() + "-min-2.webp";
//                     const outputPath = path.resolve(global.cachePath, outputFn);
//                     if (!(await isExist(outputPath))) {
//                         await sharp(filePath).resize({ height: 1980 }).toFile(outputPath);
//                     }
//                     memorycache.put(filePath, outputPath, 60*1000);
//                     filePath = outputPath;
//                 }
//             }

      
//         }
//     } catch (e) {
//         console.error("[file server error] during compression",e);
//     }

//     res.setHeader('Cache-Control', 'public, max-age=86400')
//     res.download(filePath); // Set disposition and send it.
// });

// // module.exports.init = init;
// module.exports = router;
