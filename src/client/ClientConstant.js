const BY_FILE_NUMBER = "file number";
const BY_TAG_NAME = "tag name";
const BY_TIME = "time";
const BY_LAST_READ_TIME = "last read time";
const BY_READ_COUNT = "read count"
const BY_FILE_SIZE = "file size";
const BY_AVG_PAGE_SIZE = "avg page size";
const BY_PAGE_NUMBER = "page number";
const BY_FILENAME = "file name";
const BY_GOOD_SCORE = "score";
const BY_FOLDER = "by folder name";
const BY_RANDOM = "random";

module.exports = {
    BY_FILE_NUMBER,
    BY_TAG_NAME,
    BY_TIME,
    BY_LAST_READ_TIME,
    BY_READ_COUNT,
    BY_FILE_SIZE,
    BY_AVG_PAGE_SIZE,
    BY_PAGE_NUMBER,
    BY_FILENAME,
    BY_GOOD_SCORE,
    BY_FOLDER,
    BY_RANDOM,
}

module.exports.TAG_SORT_OPTIONS = [
    BY_FILE_NUMBER,
    BY_TAG_NAME,
    BY_RANDOM
];

module.exports.AUTHOR_SORT_OPTIONS = [
    BY_FILE_NUMBER,
    BY_GOOD_SCORE,
    BY_TAG_NAME,
    BY_RANDOM
];

module.exports.SORT_OPTIONS = [
    BY_TIME,
    BY_LAST_READ_TIME,
    BY_READ_COUNT,
    BY_FILE_SIZE,
    BY_AVG_PAGE_SIZE,
    BY_PAGE_NUMBER,
    BY_FILENAME,
    BY_GOOD_SCORE,
    BY_RANDOM
];
