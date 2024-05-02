import _ from "underscore";
const clientUtil = require("./clientUtil");
const { getDir, getBaseName, getPerPageItemNumber, isSearchInputTextTyping, filesizeUitl, sortFileNames } = clientUtil;
const util = require("@common/util");

const ClientConstant = require("./ClientConstant");
const { BY_FILE_NUMBER,
    BY_TIME,
    BY_MTIME,
    BY_LAST_READ_TIME,
    BY_READ_COUNT,
    BY_FILE_SIZE,
    BY_AVG_PAGE_SIZE,
    BY_PAGE_NUMBER,
    BY_FILENAME,
    BY_GOOD_SCORE,
    BY_FOLDER,
    BY_RANDOM } = ClientConstant;




export const sortFiles = (info, files, sortOrder, isSortAsc) => {
    //-------sort algo
    const byFn = (a, b) => {
        const ap = getBaseName(a);
        const bp = getBaseName(b);
        return ap.localeCompare(bp);
    }


    // 一律先时间排序
    // 下方的sort都是stable sort。
    files = _.sortBy(files, e => {
        // 没有信息，排到前面来触发后端get thumbnail。获得信息
        const mtime = info.getMtime(e);
        const ttime = info.getTTime(e);

        if (mtime && ttime) {
            const gap = Math.abs(mtime - ttime);
            const GAP_THRESHOLD = 180 * 24 * 3600 * 1000;
            if (gap > GAP_THRESHOLD) {
                return Math.min(mtime, ttime) || Infinity;
            } else {
                return mtime || Infinity;
            }
        } else {
            return mtime || ttime;
        }
    });

    if (sortOrder === BY_RANDOM) {
        files = _.shuffle(files);
    } else if (sortOrder === BY_FILENAME) {
        files.sort((a, b) => {
            return byFn(a, b);
        });
    } else if (sortOrder == BY_GOOD_SCORE) {
        // 喜好排序
        files.sort((a, b) => {
            let s1 = info.getScore(a);
            let s2 = info.getScore(b);

            if (s1 == s2) {
                const adjustScore = (fp, score) => {
                    const { good_folder_root, not_good_folder_root } = info.context;
                    if (good_folder_root && fp.includes(good_folder_root)) {
                        score += 1;
                    } else if (not_good_folder_root && fp.includes(not_good_folder_root)) {
                        score -= 1;
                    }
                    return score;
                }
                s1 = adjustScore(a, s1);
                s2 = adjustScore(b, s2);

                return s1 - s2;
            } else {
                return s1 - s2;
            }
        })
    } else if (sortOrder === BY_FOLDER) {
        files = _.sortBy(files, e => {
            const dir = getDir(e);
            return dir;
        });
    } else if (sortOrder === BY_TIME) {
        // pass
    } else if (sortOrder === BY_MTIME) {
        //只看mtime
        files = _.sortBy(files, e => {
            const mtime = info.getMtime(e);
            return mtime || Infinity;
        });
    } else if (sortOrder === BY_LAST_READ_TIME) {
        files = _.sortBy(files, e => {
            return info.getLastReadTime(e);
        });
    } else if (sortOrder === BY_READ_COUNT) {
        files = _.sortBy(files, e => {
            return info.getReadCount(e);
        });
    } else if (sortOrder === BY_FILE_SIZE) {
        files = _.sortBy(files, e => {
            return info.getFileSize(e);
        });
    } else if (sortOrder === BY_AVG_PAGE_SIZE) {
        files = _.sortBy(files, e => {
            return info.getPageAvgSize(e);
        });
    } else if (sortOrder === BY_PAGE_NUMBER) {
        files = _.sortBy(files, e => {
            return info.getPageNum(e);
        });
    }

    if (!isSortAsc) {
        files.reverse();
    }

    return files;
}