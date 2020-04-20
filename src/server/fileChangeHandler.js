
const pathUtil = require("./pathUtil");
const {
        isExist
} = pathUtil;
const pfs = require('promise-fs');
const fs = require('fs');
const execa = require('execa');


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
                    const {stdout, stderr} = await execa("move", [src, dest]);
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
    
    app.post('/api/deleteFile', (req, res) => {
        const src = req.body && req.body.src;
    
        if(!src){
            res.sendStatus(404);
            return;
        }
    
        fs.unlink(src, (err) => {
            if (err){
                console.error(err);
                res.sendStatus(404);
            }else{
                res.sendStatus(200);
                logger.info(`[DELETE] ${src}`);
            }
        });
    });
};


