
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
const path = require('path');

const util = global.requireUtil();
const { isImage, isCompress, isMusic, arraySlice, isDisplayableInOnebook } = util;

const sevenZipHelp = require("../sevenZipHelp");

function getReason(e){
    return e.stderr || e.message || e;
}


router.post('/api/renameFile', (req, res) => {
    const src = req.body && req.body.src;
    const dest = req.body && req.body.dest;

    if(!src || !dest){
        res.sendStatus(404);
        return;
    }

    (async () =>{
        try{
            let err = await pfs.rename(src, dest);

            if(!err){
                logger.info(`[rename] ${src} to ${dest}`);
                res.sendStatus(200);
            }else{
                console.error(err);
                res.status(500).send(getReason(err));
            }
        }catch(err){
            console.error(err);
            res.status(500).send(getReason(err));
        }
    })();
});

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
                res.status(500).send(getReason(err));
            }
        }catch(e){
            console.error(e);
            res.status(500).send(getReason(e));
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
                    res.status(500).send(getReason(err));
                }else{
                    res.sendStatus(200);
                    logger.info(`[DELETE] ${src}`);
                }
            });
        }
    } catch(e) {
        console.error(e);
        res.status(500).send(getReason(e));
    }
});


async function isSimpleFolder(src){
    let content_pathes = await pfs.readdir(src);
    const otherTypes = content_pathes.filter(e => !isDisplayableInOnebook(e));

    return otherTypes.length === 0;
}

const _folder_waring_ = "This folder is not a simple img/music folder";

router.post('/api/deleteFolder', async (req, res) => {
    const src = req.body && req.body.src;

    if(!src || !(await isExist(src))){
        res.sendStatus(404);
        return;
    }

    if(!(await isSimpleFolder(src))){
        res.status(500).send(_folder_waring_);
        return;
    }

    //below is duplicate code as /api/deleteFile
    //need to improve
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
                    res.status(500).send(getReason(err));
                }else{
                    res.sendStatus(200);
                    logger.info(`[DELETE] ${src}`);
                }
            });
        }
    } catch(e) {
        console.error(e);
        res.status(500).send(getReason(e));
    }
});

router.post('/api/zipFolder', async (req, res) => {
    const src = req.body && req.body.src;

    if(!src || !(await isExist(src))){
        res.sendStatus(404);
        return;
    }

    if(! (await isSimpleFolder(src))){
        res.status(500).send(_folder_waring_);
        return;
    }


    try{
        let {stdout, stderr, resultZipPath} = await sevenZipHelp.zipOneFolder(src);
        if(stderr){
            //todo
            res.status(500).send("fail to zip");
        }else{
            res.sendStatus(200);
            logger.info(`[zipFolder] ${src}`);
        }
    } catch(e) {
        console.error(e);
        res.status(500).send("fail to zip");
    }
});

module.exports = router;
