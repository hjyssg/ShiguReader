const express = require('express');

const router = express.Router();

const homePagePath = require('./homePagePath');
const getHistory = require('./getHistory');
const lsdir = require('./lsdir');
const getGoodAuthorNames = require('./getGoodAuthorNames');
const moveOrDelete = require('./moveOrDelete');
const download = require('./download');
const search = require('./search');
const allInfo = require('./AllInfo');
const singleFileInfo = require('./singleFileInfo');
const hentaiApi = require('./hentaiApi');
const cleanCacheRoute = require('./cleanCache');
const cacheInfo = require('./CacheInfo');
const shutdown = require('./shutdown');
const minifyZip = require('./minifyZip');

router.use(homePagePath);
router.use(getHistory);
router.use(lsdir);
router.use(getGoodAuthorNames);
router.use(moveOrDelete);
router.use(download);
router.use(search);
router.use(allInfo);
router.use(singleFileInfo);
router.use(hentaiApi);
router.use(cleanCacheRoute);
router.use(cacheInfo);
router.use(shutdown);
router.use(minifyZip);

module.exports = router;
