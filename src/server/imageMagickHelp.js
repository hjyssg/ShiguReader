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

let { img_convert_quality, img_convert_dest_type,
    img_convert_huge_threshold, img_reduce_resolution_dimension,
    img_convert_min_threshold, img_convert_quality_for_middle_size_file } = userConfig;

img_convert_huge_threshold *= 1024 * 1024;
img_convert_min_threshold *= 1024 * 1024;


function logFail(filePath, e) {
    logger.error("[imageMagickHelp]", filePath, e);
}

global._has_magick_ = false;
let magick_cmd = "magick";
module.exports.init = function(){
    if (global.isWindows) {
        try{
            magick_cmd = path.join(pathUtil.getRootPath(), "resource", "imagemagick", "magick.exe");
            global._has_magick_ = true;
        }catch{
            logger.error("[ERROR] no magick on windows");
        }
        // console.log("sevenZipPath", sevenZipPath);
    } else {
        execa("magick --version")
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

        let { stdout, stderr } = await execa(magick_cmd, opt);
        return { stdout, stderr };
    } catch (e) {
        logFail("[convertImage]", e);
    }
}

module.exports.isConvertable = async function (filePath) {
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

// 如果一个文件夹parentDir只有一个folder，没有别的文件。把那个folder的所有东西移动到parentDir
async function moveSubfolderContentsToParent(parentDir) {
    // 获取parentDir中的所有文件和文件夹
    const items = await pfs.readdir(parentDir, { withFileTypes: true });
    const dirs = items.filter(item => item.isDirectory());
    const files = items.filter(item => item.isFile());

    // 确保只有一个文件夹且没有文件
    if (dirs.length === 1 && files.length === 0) {
        const subfolderName = dirs[0].name;
        const subfolderPath = path.join(parentDir, subfolderName);

        // 获取子文件夹中的所有文件和文件夹
        const subfolderItems = await pfs.readdir(subfolderPath, { withFileTypes: true });

        for (const item of subfolderItems) {
            const sourcePath = path.join(subfolderPath, item.name);
            const destPath = path.join(parentDir, item.name);

            // 移动子文件夹中的内容到父文件夹
            await pfs.rename(sourcePath, destPath);
        }

        // 删除现在已经空的子文件夹
        await pfs.rmdir(subfolderPath);

        console.log(`Contents moved from ${subfolderName} to ${parentDir}`);
    } else {
        console.log('Parent directory does not meet the conditions.');
    }
}

//ONLY KEEP THE CORRECT FILES IN FOLDER AFTER EVERYTHING
module.exports.minifyOneFile = async function (filePath) {
    let extractOutputPath;
    try {
        const oldStat = await serverUtil.common.getStatAndUpdateDB(filePath);
        const oldTemp = await listZipContentAndUpdateDb(filePath);
        const oldFiles = oldTemp.files;

        const bookName = path.basename(filePath, path.extname(filePath));
        const convertSpace = getImgConverterCachePath();
        extractOutputPath = path.join(convertSpace, bookName);

        //mkdir for output
        if (!(await isExist(extractOutputPath))) {
            const mdkirErr = await serverUtil.mkdir(extractOutputPath, { recursive: true });
            if (mdkirErr instanceof Error) {
                logFail(extractOutputPath, "cannot create output folder");
                return;
            }
        }

        //do a brand new extract
        logger.info("[minifyOneFile] extractAll....");
        const { pathes, error } = await extractAll(filePath, extractOutputPath, true);
        if (error) {
            logFail(filePath, "failed to extractAll", error);
            return;
        }

        await moveSubfolderContentsToParent(extractOutputPath)


        logger.info("[minifyOneFile] begin images convertion --------------");
        logger.info(filePath);

        const { saveSpace } = await minifyFolder(extractOutputPath);

        if( saveSpace < 1000){
            logFail(filePath, "not a useful work. abandon");
            return;
        }

        //zip into a new zip file
        //todo: The process cannot access the file because it is being used by another process
        let { stdout, stderr, resultZipPath } = await sevenZipHelp.zipOneFolder(extractOutputPath);
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
 
        //manually let file have the same modify time
        const error2 = await pfs.utimes(resultZipPath, oldStat.atime, oldStat.mtime);
        if (error2) {
            logFail(filePath, "pfs.utimes failed");
            deleteCache(resultZipPath);
        } else {
            return {
                saveSpace
            }
        }
    } catch (e) {
        logFail(filePath, e);
    } finally {
        //maybe let user to delete file manually?
        deleteCache(extractOutputPath);
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


function getFn(e) {
    return path.basename(e, path.extname(e));
}

const isNewZipSameWithOriginalFiles = module.exports.isNewZipSameWithOriginalFiles = function (newFiles, files) {
    if (!newFiles) {
        return false;
    }

    // naive algo here
    // TODO 文件夹名带.会被当做文件夹
    const isFile = e => {
        return !pathUtil.estimateIfFolder(e);
    };

    //todo: need to check if other type files are missing
    const expect_file_names = files.filter(isFile).map(getFn).sort();
    const resulted_file_names = newFiles.filter(isFile).map(getFn).sort();
    return _.isEqual(resulted_file_names, expect_file_names)
}


const userful_percent = 20;
const fileiterator = require('./file-iterator');
const trash = require('trash');
const minifyFolder = module.exports.minifyFolder = async function (filePath) {
    logger.info("-----begin images convertion --------------");
 
    const { pathes, infos } = await fileiterator(filePath, {});

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

                const newStat = await serverUtil.common.getStatAndUpdateDB(outputfp);
                const reducePercentage = (100 - newStat.size / oldSize * 100).toFixed(2);
                // 逐张判断有用语法
                if (reducePercentage < userful_percent || newStat.size < 1000) {
                    // 压缩跟没压缩一样就删掉
                    await deleteThing(outputfp);
                } else {
                    //delete input file
                    await deleteThing(inputFp);
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

    logger.info("size reduce ", filesizeUitl(saveSpace, { base: 2 }));
    return {
        saveSpace
    }
}

async function deleteThing(src) {
    const convertSpace = getImgConverterCachePath();
    if (src.includes(convertSpace)) {
        // 处于缓存文件夹的直接删除就好了
        const err = await pfs.unlink(src)
        if (err) { throw err; }
    } else {
        await trash([src]);
    }
}