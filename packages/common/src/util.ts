
//https://stackoverflow.com/questions/11852589/what-image-formats-do-the-major-browsers-support-2012
const imageTypes = [".jpg", ".png", ".jpeg", ".gif", ".bmp", ".webp", ".avif"];
const compressTypes = [".zip", ".rar", ".7zip", ".7z", ".gzip", ".tar"];
const musicTypes = [".mp3", ".wav", ".m4a", ".wma", ".flac", ".ogg", ".m4p", ".aiff"];
const videoTypes = [".mp4", ".3gp", ".avi", ".mov", ".mp4", ".m4v", ".mkv", ".webm", ".flv"];

function escapeDot(arr: string[]): string[] {
    return arr.map(e => e.replace(".", "\\."))
}

//ends with
const imageTypesRegex = new RegExp("(" + escapeDot(imageTypes).join("|") + ")$", "i");
const compressTypesRegex = new RegExp("(" + escapeDot(compressTypes).join("|") + ")$", "i");
const musicTypesRegex = new RegExp("(" + escapeDot(musicTypes).join("|") + ")$", "i");
const videoTypesRegex = new RegExp("(" + escapeDot(videoTypes).join("|") + ")$", "i");


export function isOnlyDigit(str: string): boolean {
    return str.match(/^[0-9]+$/) != null
}

export function isGif(fn: string): boolean {
    return fn.toLowerCase().endsWith(".gif");
}

/**
 * 是否为图片文件
 */
export function isImage(fn: string): boolean {
    return !!fn.toLowerCase().match(imageTypesRegex);
}

/**
 * 是否为压缩文件
 */
export function isCompress(fn: string): boolean {
    return !!fn.toLowerCase().match(compressTypesRegex);
}

/**
 * 是否为音乐文件
 */
export function isMusic(fn: string): boolean {
    return !!fn.toLowerCase().match(musicTypesRegex);
}

export function isVideo(fn: string): boolean {
    return !!fn.toLowerCase().match(videoTypesRegex);
}

const companyNames = "ABP ATFB AVOP CPDE CSCT DASD EBOD FDGD GANA GGG HND HNDS ID IPX IPZ KAWD LCBD LXVS MDS MIDE MIMK MIRD MUKC NHDTA PGD PPPD PPT REBDB SDDE SHKD SNIS SOE SSNI STAR TEK TONY TPRO TSDV WANZ WAT YRZ ZUKO DAP";
const avRegex = new RegExp(companyNames.split(" ").filter(e => e.length > 1).map(e => `${e}\\d{3}`).join("|"));

export function isAv(fn: string): boolean {
    if (!isVideo(fn)) {
        return false;
    }

    //example ABP-265
    if (/[A-Za-z]{2,}-\d{3}/.test(fn)) {
        return true;
    }

    //ABP264
    const fnUp = fn.toUpperCase();
    return avRegex.test(fnUp);
}

//not for .gif
const compressable = [".jpg", ".jpeg", ".png", ".avif", "webp", ".bmp"]
export function canBeCompressed(fn: string): boolean {
    const fnl = fn.toLowerCase();
    return compressable.some((e) => fnl.endsWith(e));
}

export const hasDuplicate = (arr: any[]): boolean => {
    return new Set(arr).size !== arr.length;
}

/**
 * 用来排序图片和mp3的。files既可能是filename也可能是filepath
 * getDirName is optional and should return the directory portion used for sorting
 */
export function _sortFileNames(files: string[], getBaseName: (f: string) => string, getDirName?: (f: string) => string): void {
    files.sort((a, b) => {
        // 使用 getBaseName 获取文件名部分
        const fileNameA = getBaseName(a);
        const fileNameB = getBaseName(b);

        // 获取路径部分（去掉文件名部分后的内容）
        const dirA = (() => {
            if (getDirName) {
                return getDirName(a) || "";
            }
            if (typeof fileNameA === "string" && a.endsWith(fileNameA)) {
                return a.slice(0, a.length - fileNameA.length) || "";
            }
            return "";
        })();

        const dirB = (() => {
            if (getDirName) {
                return getDirName(b) || "";
            }
            if (typeof fileNameB === "string" && b.endsWith(fileNameB)) {
                return b.slice(0, b.length - fileNameB.length) || "";
            }
            return "";
        })();

        // 先按路径部分排序，确保不同子目录下的同名文件不会混在一起
        if (dirA !== dirB) {
            return dirA.localeCompare(dirB);
        } else {
            // 如果路径部分相同，按文件名数值排序
            return fileNameA.localeCompare(fileNameB, undefined, { numeric: true });
        }
    });
}

export async function pause(time: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, time));
}

export function arraySlice<T>(arr: T[], beg: number, end: number): T[] {
    const len = arr.length;
    let _beg = beg >= 0 ? beg : len + beg;
    let _end = end >= 0 ? end : len + end;

    let result: T[] = [];
    if (beg >= 0 && end >= 0) {
        //normal
        result = arr.slice(beg, end);
    } else if (beg < 0 && end > 0) {
        result = arr.slice(_beg).concat(arr.slice(0, end));
    } else if (beg >= 0 && end < 0) {
        result = arr.slice(beg, _end);
    } else {
        throw "wrf dude"
    }
    return result;
}

export function cutIntoSmallArrays<T>(arr: T[], size?: number): T[][] {
    size = size || 10000;
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        const chunk = arr.slice(i, i + size);
        result.push(chunk);
    }
    return result;
}

export function getCurrentTime(): number {
    return new Date().getTime();
}

export function isDisplayableInExplorer(e: string): boolean {
    return isCompress(e) || isVideo(e);
}

export function isDisplayableInOnebook(e: string): boolean {
    return isImage(e) || isMusic(e);
}

export function escapeRegExp(string: string): RegExp {
    const str = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    const reg = new RegExp(str, 'i');
    return reg;
}

export function isWindowsPath(string: string): boolean {
    return /[A-Za-z]:/.test(string);
}

/**
 * 求平均数
 */
export function getAverage(intArray: number[]): number {
    if (intArray.length === 0) {
        return 0;
    }

    const sum = intArray.reduce((acc, val) => acc + val);
    const avg = sum / intArray.length;

    return avg;
}

/**
 * Calculate average image size for a zip/folder.
 *
 * @param {Object} param0
 * @param {number} param0.pageNum    total number of files reported
 * @param {number} [param0.totalImgSize] summed size of image files
 * @param {number} [param0.videoNum] number of video files included
 * @returns {number} average size of image files
 */
export function calcAvgImgSize({ pageNum, totalImgSize = 0, videoNum = 0 }: { pageNum: number; totalImgSize?: number; videoNum?: number }): number {
    const imgCount = Math.max(0, pageNum - videoNum);
    if (imgCount === 0) {
        return 0;
    }

    return totalImgSize / imgCount;
}


/** 写一个js函数，把string留头留尾，中间的字符换成省略号。穿参数设置最终字符数 */
export const truncateString = (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str;
    const ellipsis = '...';
    const truncatedLength = maxLength - ellipsis.length;
    const frontChars = Math.ceil(truncatedLength / 2);
    const backChars = Math.floor(truncatedLength / 2);
    const truncatedString = str.substr(0, frontChars) + ellipsis + str.substr(str.length - backChars);
    return truncatedString;
}
