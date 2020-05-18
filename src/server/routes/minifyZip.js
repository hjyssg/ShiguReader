
const express = require('express');
const router = express.Router();
const imageMagickHelp = require("../imageMagickHelp");
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;


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
    await limit(() => imageMagickHelp.minifyOneFile(filePath));
    minifyZipQue.shift();

});

module.exports = router;
