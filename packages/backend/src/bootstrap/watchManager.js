const watcher = require('@parcel/watcher');
const fs = require('fs').promises;
const _ = require('underscore');
const util = require('../../../common/src/util');
const pathUtil = require('../utils/path-util');
const appState = require('../state/appState');
const { deleteCallBack } = require('../services/server-common');

const { isHiddenFile, estimateIfFolder, isSub, getExt } = pathUtil;
const { isDisplayableInExplorer, isDisplayableInOnebook } = util;

function createWatchManager({ cacheDb, db, filewatch, viewImgFolder }) {
    const cachePath = appState.getCachePath();
    let cacheSubscription = null;

    function shouldWatchForCache(fp, stat) {
        if (isHiddenFile(fp)) {
            return false;
        }
        if (estimateIfFolder(fp) || (stat && stat.isDirectory())) {
            return true;
        }
        return true;
    }

    async function setUpCacheWatch() {
        try {
            cacheSubscription = await watcher.subscribe(cachePath, async (err, events) => {
                if (err) {
                    console.error('[parcel/watcher] Cache watch error:', err);
                    return;
                }

                for (const event of events) {
                    try {
                        if (event.type === 'create') {
                            const stats = await fs.stat(event.path);
                            if (!shouldWatchForCache(event.path, stats)) {
                                continue;
                            }
                            cacheDb.updateStatToCacheDb(event.path, stats);
                        }
                    } catch (eventError) {
                        if (eventError.code !== 'ENOENT') {
                            console.error('[parcel/watcher] Cache event error:', eventError);
                        }
                    }
                }
            });
            console.log(`[parcel/watcher] Cache watcher set up for: ${cachePath}`);
        } catch (error) {
            console.error('[parcel/watcher] Failed to set up cache watch:', error);
        }
    }

    async function stopCacheWatch() {
        if (cacheSubscription) {
            await cacheSubscription.unsubscribe();
            cacheSubscription = null;
            console.log('[parcel/watcher] Cache watcher stopped');
        }
    }

    function shouldScan(fp, stat) {
        if (fp.includes(cachePath)) {
            return false;
        }

        if (isHiddenFile(fp) || pathUtil.isForbid(fp)) {
            return false;
        }

        if (stat && stat.isDirectory()) {
            return true;
        }

        const ext = getExt(fp);
        let result = estimateIfFolder(fp) || isDisplayableInExplorer(ext);
        if (viewImgFolder) {
            result = result || isDisplayableInOnebook(ext);
        }
        return result;
    }

    function shouldIgnoreForNormal(fp, stat) {
        return !shouldScan(fp, stat);
    }

    async function addDirsToWatch(dirPaths) {
        if (!Array.isArray(dirPaths) || dirPaths.length === 0) {
            return;
        }

        for (const filePath of dirPaths) {
            await filewatch.fastFileIterate({
                filePath,
                db,
                shouldIgnoreForNormal,
            });
            await filewatch.addWatch({
                folderPath: filePath,
                deleteCallBack,
                shouldScan,
                db,
            });
        }
    }

    function filterScanPaths(scanPaths) {
        if (!Array.isArray(scanPaths)) {
            return [];
        }
        let willScan = _.sortBy(scanPaths, e => e.length);
        for (let ii = 0; ii < willScan.length; ii++) {
            for (let jj = ii + 1; jj < willScan.length; jj++) {
                const p1 = willScan[ii];
                const p2 = willScan[jj];
                if (isSub(p1, p2)) {
                    willScan[jj] = '_to_remove_';
                }
            }
        }
        return willScan.filter(e => e !== '_to_remove_');
    }

    function updateScannedPaths(paths) {
        appState.setScannedPaths(paths);
    }

    return {
        addDirsToWatch,
        setUpCacheWatch,
        stopCacheWatch,
        shouldScan,
        shouldIgnoreForNormal,
        filterScanPaths,
        updateScannedPaths,
    };
}

module.exports = createWatchManager;
