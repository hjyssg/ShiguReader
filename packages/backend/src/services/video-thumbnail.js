const path = require('path');
const stringHash = require('string-hash');
const execa = require('../utils/own-execa');
const util = require('../../../common/src/util');
const pathUtil = require('../utils/path-util');
const appState = require('../state/appState');
const thumbnailDb = require('../models/thumbnail-db');
const logger = require('../config/logger');

const generatingTasks = new Map();
const GIF_DURATION_SECONDS = 3;
const GIF_WIDTH = 320;
const GIF_FPS = 12;

let ffmpegBinary = 'ffmpeg';
let ffmpegReadyPromise = null;
global._has_ffmpeg_ = null;

function resolveBundledFfmpeg() {
    try {
        const rootPath = (pathUtil.getRootPath && pathUtil.getRootPath()) || path.join(__dirname, '..', '..');
        const ffmpegModulePath = path.join(rootPath, 'resource', 'ffmpeg');
        const bundled = require(ffmpegModulePath);
        return bundled && bundled.ffmpeg ? bundled.ffmpeg : bundled;
    } catch (error) {
        logger.error('[video-thumbnail] no bundled ffmpeg found', error && error.message ? error.message : error);
        return null;
    }
}

function setFfmpegBinary(candidate) {
    if (!candidate) {
        global._has_ffmpeg_ = false;
        ffmpegReadyPromise = null;
        return;
    }

    ffmpegBinary = candidate;
    global._has_ffmpeg_ = null;
    ffmpegReadyPromise = execa(ffmpegBinary, ['-version'])
        .then(() => {
            global._has_ffmpeg_ = true;
        })
        .catch(error => {
            global._has_ffmpeg_ = false;
            logger.error('[video-thumbnail] ffmpeg not available', error && error.stderr ? error.stderr : error);
        });
    return ffmpegReadyPromise;
}

function init() {
    if (global.isWindows) {
        const bundledPath = resolveBundledFfmpeg();
        if (bundledPath) {
            setFfmpegBinary(bundledPath);
        } else {
            logger.error('[video-thumbnail] Windows environment detected but no ffmpeg.exe bundled');
            global._has_ffmpeg_ = false;
        }
    } else {
        setFfmpegBinary('ffmpeg');
    }
}

function buildOutputPath(filePath) {
    const folderPath = appState.getThumbnailFolderPath();
    const parsed = path.parse(filePath);
    const hash = stringHash(filePath).toString(36);
    const fileName = `${parsed.name}-${hash}.gif`;
    return path.join(folderPath, fileName);
}

async function ensureExistingThumbnail(filePath) {
    const thumbRows = thumbnailDb.getThumbnailArr(filePath);
    if (thumbRows[0]) {
        const existingPath = thumbRows[0].thumbnailFilePath;
        if (await pathUtil.isExist(existingPath)) {
            return existingPath;
        }
    }
    return null;
}

async function generateGif(filePath) {
    if (!await pathUtil.isExist(filePath)) {
        return null;
    }

    const folderPath = appState.getThumbnailFolderPath();
    if (!folderPath) {
        return null;
    }

    if (global._has_ffmpeg_ === null && !ffmpegReadyPromise) {
        init();
    }

    if (ffmpegReadyPromise) {
        await ffmpegReadyPromise.catch(() => null);
    }

    if (!global._has_ffmpeg_) {
        return null;
    }

    const outputPath = buildOutputPath(filePath);
    try {
        await execa(ffmpegBinary, [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-ss', '1',
            '-i', filePath,
            '-t', String(GIF_DURATION_SECONDS),
            '-vf', `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`,
            '-loop', '0',
            outputPath,
        ]);
    } catch (error) {
        logger.warn('[video-thumbnail] Failed to generate gif', filePath, error.stderr || error);
        return null;
    }

    const exists = await pathUtil.isExist(outputPath);
    if (!exists) {
        return null;
    }

    thumbnailDb.addNewThumbnail(filePath, outputPath);
    return outputPath;
}

async function getVideoThumbnail(filePath) {
    if (!filePath || !util.isVideo(filePath)) {
        return null;
    }

    if (global._has_ffmpeg_ === null && !ffmpegReadyPromise) {
        init();
    }

    if (ffmpegReadyPromise) {
        await ffmpegReadyPromise.catch(() => null);
    }

    if (!global._has_ffmpeg_) {
        return null;
    }

    const existing = await ensureExistingThumbnail(filePath);
    if (existing) {
        return existing;
    }

    if (generatingTasks.has(filePath)) {
        return generatingTasks.get(filePath);
    }

    const task = generateGif(filePath).finally(() => {
        generatingTasks.delete(filePath);
    });
    generatingTasks.set(filePath, task);
    return task;
}

module.exports = {
    init,
    getVideoThumbnail,
};
