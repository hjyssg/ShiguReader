
const express = require('express');
const router = express.Router();
const imageMagickHelp = require("../imageMagickHelp");
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const filesizeUitl = require('filesize');
const logger = require("../logger");

const count = {
    processed: 0,
    saveSpace: 0
};
const minifyZipQue = [];
router.post('/api/minifyZipQue', (req, res) => {
    res.send({
        minifyZipQue
    })
})

const pLimit = require('p-limit');
const limit = pLimit(1);

router.post('/api/minifyZip', async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath)) || minifyZipQue.includes(filePath)  ) {
        res.sendStatus(404);
    }else{
        //add to queue
        //it takes long time
        res.sendStatus(200);
    }

    minifyZipQue.push(filePath);
    try{
      const temp = await limit(() => imageMagickHelp.minifyOneFile(filePath));
      if(temp){
        //only success will return result
        const { oldSize, newSize,  saveSpace  } = temp;
        count.processed++
        count.saveSpace += saveSpace;
        logger.info("total space save:",  filesizeUitl(count.saveSpace, {base: 2}))
      }
    }catch(e){
        logger.error("[/api/minifyZip]", e);
    }finally{
        minifyZipQue.shift();
        if(minifyZipQue.length === 0){
            console.log("[/api/minifyZip] the task queue is now empty");
        }
    }
});

module.exports = router;
