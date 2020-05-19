
const pathUtil = require("../pathUtil");
const {
        isExist
} = pathUtil;
const pfs = require('promise-fs');
const fs = require('fs');
const execa = require('execa');
const userConfig = global.requireUserConfig();
const isWindows = require('is-windows');
const express = require('express');
const router = express.Router();
const logger = require("../logger");

router.post('/api/moveFile', (req, res) => {
    const src = req.body && req.body.src;
    const dest = req.body && req.body.dest;

    if(!src || !dest){
        res.sendStatus(404);
        return;
    }

    (async () =>{
        try{
            let err;
            if(!(await isExist(dest))){
                err = await pfs.mkdir(dest, {recursive: true});


            }
            if (!err) {
                const cmdStr = isWindows()? "move" : "mv";
                const {stdout, stderr} = await execa(cmdStr, [src, dest]);
                err = stderr;
                // err = await pfs.rename(src, dest);
            }

            if(!err){
                logger.info(`[MOVE] ${src} to ${dest}`);
                res.sendStatus(200);
            }else{
                console.error(err);
                res.sendStatus(404);
            }
        }catch(e){
            console.error(e);
            res.sendStatus(404);
        }
    })();
});

router.post('/api/deleteFile', async (req, res) => {
    const src = req.body && req.body.src;

    if(!src || !(await isExist(src))){
        res.sendStatus(404);
        return;
    }

    try{
        if(userConfig.move_file_to_recyle){
            const trash = require('trash');
            await trash([src]);
            if(!(await isExist(src))){
                res.sendStatus(200);
                logger.info(`[DELETE] ${src}`);
            } else {
                //missing is delete
                res.sendStatus(200);
            }
        }else{
            fs.unlink(src, (err) => {
                if (err){
                    console.error(err);
                    res.sendStatus(404);
                }else{
                    res.sendStatus(200);
                    logger.info(`[DELETE] ${src}`);
                }
            });
        }
    } catch(e) {
        console.error(e);
        res.sendStatus(404);
    }
});



module.exports = router;
