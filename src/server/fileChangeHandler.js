
const pathUtil = require("./pathUtil");
const {
        isExist
} = pathUtil;
const pfs = require('promise-fs');
const fs = require('fs');
const execa = require('execa');
const userConfig = require('../user-config');
const isWindows = require('is-windows')


//handle move file, delete file
module.exports.init = function(app, logger){

    app.post('/api/moveFile', (req, res) => {
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
                    err = await pfs.mkdir(dest);
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
    
    app.post('/api/deleteFile', async (req, res) => {
        const src = req.body && req.body.src;
    
        if(!src || !(await isExist(src))){
            res.sendStatus(404);
            return;
        }

        if(userConfig.move_file_to_recyle){
            const trash = require('trash');
            await trash([src]);
            if(!(await isExist(src))){
              res.sendStatus(200);
              logger.info(`[DELETE] ${src}`);
            } else{
              console.error(err);
              res.sendStatus(404);
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
    });
};


