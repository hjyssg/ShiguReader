const express = require('express');
const path = require('path');

global.requireUtil = () => require("../common/util");
global.requireUserConfig = () => require("../config/user-config");
global.requireConstant = () => require("../common/constant");
const serverUtil = require("./serverUtil");

const userConfig = global.requireUserConfig();

const pathUtil = require("./pathUtil");
const rootPath = pathUtil.getRootPath();
const { cache_folder_name, thumbnail_folder_name, view_img_folder } = userConfig
const cachePath = path.join(rootPath, cache_folder_name);
// const thumbnailFolderPath = path.join(rootPath, thumbnail_folder_name);
// global.thumbnailFolderPath = thumbnailFolderPath;
global.cachePath = cachePath;

const app = express();
app.use(express.static('dist', {
    maxAge: (1000 * 3600).toString()
}));
// app.use(express.static(rootPath, {
//     maxAge: (1000 * 3600 * 24).toString() // uses milliseconds per docs
// }));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
// https://stackoverflow.com/questions/50304779/payloadtoolargeerror-request-entity-too-large?noredirect=1&lq=1
app.use(express.json({limit: '50mb'}));

async function init() {
    // todo from cmd
    const port =  34213;
    
    //express does not check if the port is used and remains slient
    // we need to check
    const isPortOccupied =  await serverUtil.isPortOccupied(port);
    if(isPortOccupied){
        logger.error(`[Server Init] port ${port} is occupied `);
        process.exit(22);
    }

    const server = app.listen(port, async () => {
        console.log("----------------------------------------------------------------");
        console.log(`Express Server listening on port ${port}`);
        console.log("----------------------------------------------------------------");
    }).on('error', (error) => {
        logger.error("[Server Init]", error.message);
        //exit the current program
        process.exit(22);
    });
}

const homePagePath = require("./routes/homePagePath");
app.use(homePagePath);

const getGoodAuthorNames = require("./routes/getGoodAuthorNames");
app.use(getGoodAuthorNames);

const getHistory = require("./routes/getHistory");
app.use(getHistory);

const download = require("./routes/download");
app.use(download);

const hentaiApi = require("./routes/hentaiApi");
app.use(hentaiApi);

app.post('/*', (req, res) => {
    res.sendStatus(404);
})

init();

