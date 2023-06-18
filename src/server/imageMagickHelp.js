const path = require('path');
const execa = require('./own_execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const logger = require("./logger");
const util = global.requireUtil();
const pathUtil = require("./pathUtil");
const { isImage, getCurrentTime, isGif } = util;

const sevenZipHelp = require("./sevenZipHelp");
const { listZipContentAndUpdateDb, extractAll } = sevenZipHelp;

const { isExist, getImgConverterCachePath } = pathUtil;

const userConfig = global.requireUserConfig();
const filesizeUitl = require('filesize');

const rimraf = require("./rimraf");

const serverUtil = require("./serverUtil");
const { getStatAndUpdateDB } = serverUtil.common;

let { img_convert_quality, img_convert_dest_type,
    img_convert_huge_threshold, img_reduce_resolution_dimension,
    img_convert_min_threshold, img_convert_quality_for_middle_size_file } = userConfig;

img_convert_huge_threshold *= 1024 * 1024;
img_convert_min_threshold *= 1024 * 1024;


function logFail(filePath, e) {
    logger.error("[imageMagickHelp]", filePath, e);
}

global._has_magick_ = false;
module.exports.init = function(){
    execa("magick")
    .then((std) => {
        global._has_magick_ = true;
     })
    .catch(e => {
        logger.warn("[Warning]Did not install ImageMagic.")
        logger.warn("https://imagemagick.org")
        logger.warn("Highly Recommend. It is used to create thumbnail and reduce image size")
        logger.warn("----------------------------------------------------------------");
    });
}


//https://imagemagick.org/script/download.php#windows

async function convertImage(imgFilePath, outputImgPath, oldImgSize) {
    try {
        let opt;
        if (oldImgSize > img_convert_huge_threshold) {
            opt = [imgFilePath, "-strip", "-quality", img_convert_quality, "-resize", `${img_reduce_resolution_dimension}\>`, outputImgPath];
        } else {
            opt = [imgFilePath, "-strip", "-quality", img_convert_quality_for_middle_size_file, outputImgPath];
        }

        let { stdout, stderr } = await execa("magick", opt);
        return { stdout, stderr };
    } catch (e) {
        logFail("[convertImage]", e);
    }
}

module.exports.isConertable = async function (filePath) {
    if (!global._has_magick_) {
        return "No magick installed";
    }

    //check if already exist minfied version
    //! hard-code here
    const bookName = path.basename(filePath, path.extname(filePath));
    // const subfoldername = `from_${path.basename(path.dirname(filePath))}`
    // const convertSpace = path.join(getImgConverterCachePath(), subfoldername);
    const convertSpace = getImgConverterCachePath();
    const outputFile = path.join(convertSpace, bookName + ".zip");

    if ((await isExist(outputFile))) {
        return "already minified"
    }

    let text = "allow_to_minify";
    return text;
}

function isImgConvertable(fileName, size) {
    return isImage(fileName) && !isGif(fileName) && size > img_convert_min_threshold;
}

const userful_percent = 20;


//ONLY KEEP THE CORRECT FILES IN FOLDER AFTER EVERYTHING
module.exports.minifyOneFile = async function (filePath) {
    let extractOutputPath;
    let minifyOutputPath;
    try {
        const oldStat = await getStatAndUpdateDB(filePath);
        const oldTemp = await listZipContentAndUpdateDb(filePath);
        const oldFiles = oldTemp.files;

        //one folder for extract
        //one for minify image
        const bookName = path.basename(filePath, path.extname(filePath));
        // const subfoldername = `from_${path.basename(path.dirname(filePath))}`
        // const convertSpace = path.join(getImgConverterCachePath(), subfoldername);
        const convertSpace = getImgConverterCachePath();
        extractOutputPath = path.join(convertSpace, bookName + "-original");
        minifyOutputPath = path.join(convertSpace, bookName);

        //mkdir for output
        if (!(await isExist(minifyOutputPath))) {
            const mdkirErr = await serverUtil.mkdir(minifyOutputPath, { recursive: true });
            if (mdkirErr instanceof Error) {
                logFail(minifyOutputPath, "cannot create output folder");
                return;
            }
        }

        //do a brand new extract
        logger.info("[minifyOneFile] extractAll....");
        const { pathes, error } = await extractAll(filePath, extractOutputPath);
        if (error) {
            logFail(filePath, "failed to extractAll", error);
            return;
        }


        if (!isExtractAllSameWithOriginalFiles(pathes, oldFiles)) {
            logFail(filePath, "ExtractAll Different than Original Files");
            return;
        }
        logger.info("[minifyOneFile] begin images convertion --------------");
        logger.info(filePath);
        const _pathes = pathes;
        const total = _pathes.length;
        let converterError;
        const beginTime = getCurrentTime();

        //convert one by one
        for (let ii = 0; ii < total; ii++) {
            const fname = _pathes[ii];
            const inputFp = path.resolve(extractOutputPath, fname);
            try {
                const stat = await pfs.stat(inputFp);
                if (stat.isDirectory()) {
                    continue;
                }
                const oldSize = stat.size;
                let simplyCopy = !isImgConvertable(fname, oldSize)

                if (simplyCopy) {
                    const outputImgPath = path.resolve(minifyOutputPath, fname);
                    //this copy file does not create folder and isnot recursive
                    await pfs.copyFile(inputFp, outputImgPath);
                } else {
                    //use imageMagik to convert 
                    //  magick 1.jpeg   50 1.webp
                    const name = path.basename(fname, path.extname(fname)) + img_convert_dest_type;
                    const outputImgPath = path.resolve(minifyOutputPath, name);
                    let { stdout, stderr } = await convertImage(inputFp, outputImgPath, oldSize);
                    if (stderr) {
                        throw stderr;
                    }

                    const timeSpent = getCurrentTime() - beginTime;
                    const timePerImg = timeSpent / (ii + 1) / 1000; // in second
                    const remaintime = (total - ii) * timePerImg;
                    if (ii + 1 < total) {
                        logger.info(`${ii + 1}/${total}      ${(timePerImg).toFixed(2)}s per file   ${remaintime.toFixed(2)}s left`);
                    } else {
                        logger.info(`${ii + 1}/${total}`);
                        // logger.info("finish convertion. going to check if there is any error")
                    }
                }

            } catch (err) {
                converterError = err;
                break;
            }
        }

        if (converterError) {
            logFail(filePath, converterError);
            return;
        }

        //zip into a new zip file
        //todo: The process cannot access the file because it is being used by another process
        let { stdout, stderr, resultZipPath } = await sevenZipHelp.zipOneFolder(minifyOutputPath);
        if (stderr) {
            logFail(filePath, "sevenZipHelp.zipOneFolder fail");
            deleteCache(resultZipPath);
            return;
        }

        const temp = await listZipContentAndUpdateDb(resultZipPath);
        const filesInNewZip = temp.files;
        if (!isNewZipSameWithOriginalFiles(filesInNewZip, oldFiles)) {
            logFail(filePath, "filesInNewZip is missing files");
            deleteCache(resultZipPath);
            return;
        }
        const newStat = await getStatAndUpdateDB(resultZipPath);
        const reducePercentage = (100 - newStat.size / oldStat.size * 100).toFixed(2);
        logger.info(`[imageMagickHelp] size reduce ${reducePercentage}%`);

        if (reducePercentage < userful_percent) {
            logFail(filePath, "not a useful work. abandon");
            deleteCache(resultZipPath);
        } else {
            //manually let file have the same modify time
            const error2 = await pfs.utimes(resultZipPath, oldStat.atime, oldStat.mtime);
            if (error2) {
                logFail(filePath, "pfs.utimes failed");
                deleteCache(resultZipPath);
            } else {
                // logger.info("convertion done", filePath);
                logger.info("original size", filesizeUitl(oldStat.size, { base: 2 }));
                logger.info("new size", filesizeUitl(newStat.size, { base: 2 }));
                logger.info(`size reduce ${reducePercentage}%`);
                logger.info("output file is at", convertSpace);
                return {
                    oldSize: oldStat.size,
                    newSize: newStat.size,
                    saveSpace: (oldStat.size - newStat.size)
                }
            }
        }
    } catch (e) {
        logFail(filePath, e);
    } finally {
        //maybe let user to delete file manually?
        deleteCache(extractOutputPath);
        deleteCache(minifyOutputPath);
        logger.info("----------------------------------------------------------------");
    }
}

function deleteCache(filePath) {
    if (filePath) {
        rimraf(filePath, (err) => {
            if (err) {
                logger.error("[clean imageMagickHelp]", filePath, err);
            }
        });
    }
}

//todo 下面这两个函数有点雷同啊
function isExtractAllSameWithOriginalFiles(newFiles, files) {
    if (!newFiles) {
        return false;
    }

    const expect_file_names = files.filter(isImage).map(e => path.basename(e)).sort();
    const resulted_file_names = newFiles.filter(isImage).map(e => path.basename(e)).sort();
    return _.isEqual(resulted_file_names, expect_file_names);
}

function getFn(e) {
    return path.basename(e, path.extname(e));
}

const isNewZipSameWithOriginalFiles = module.exports.isNewZipSameWithOriginalFiles = function (newFiles, files) {
    if (!newFiles) {
        return false;
    }

    //naive algo here
    const isFile = e => e && e.includes(".");

    //todo: need to check if other type files are missing
    const expect_file_names = files.filter(isFile).map(getFn).sort();
    const resulted_file_names = newFiles.filter(isFile).map(getFn).sort();
    return _.isEqual(resulted_file_names, expect_file_names)
}

const fileiterator = require('./file-iterator');
const trash = require('trash');
module.exports.minifyFolder = async function (filePath) {
    logger.info("-----begin images convertion --------------");
    //only one level
    const { pathes, infos } = await fileiterator(filePath, {
        filter: util.isImage
    });

    const sufix = "_temp_compress.jpg";
    const total = pathes.length;
    let saveSpace = 0;
    for (let ii = 0; ii < pathes.length; ii++) {
        try {
            const inputFp = pathes[ii];
            if (inputFp.endsWith(sufix)) {
                continue;
            }
            const oldSize = infos[inputFp].size;
            const dirPath = path.dirname(inputFp);
            const imgName = path.basename(inputFp, path.extname(inputFp));
            const outputfn = imgName + sufix;
            const outputfp = path.resolve(dirPath, outputfn);

            if (isImgConvertable(inputFp, oldSize)) {
                await convertImage(inputFp, outputfp, oldSize);

                const newStat = await getStatAndUpdateDB(outputfp);
                const reducePercentage = (100 - newStat.size / oldSize * 100).toFixed(2);
                if (reducePercentage < userful_percent || newStat.size < 1000) {
                    await trash([outputfp]);
                } else {
                    //delete input file
                    await trash([inputFp]);
                    //rename output to input file
                    let err = await pfs.rename(outputfp, inputFp);
                    if (err) { throw err; }

                    saveSpace += (oldSize - newStat.size);
                }
            }
            logger.info(`${ii + 1}/${total} ${filePath}`);
        } catch (e) {
            logger.error(e);
        }
    }

    return {
        saveSpace
    }
}