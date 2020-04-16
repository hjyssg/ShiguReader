'use strict';

/**
 * MUST Where ShiguReader will scan files 修改成本地存放漫画zip的路径
 */
module.exports.home_pathes = ["T:\\迅雷下载", "D:\\_Happy_Lesson", "D:\\_Happy_Lesson\\_Unread", "D:\\_Happy_Lesson\\_Going_to_sort", "E:\\_Temp_Music"];

/** 
 * OPTIONAL where to move file
 */
const now = new Date();
const y = now.getFullYear();
let mm = now.getMonth()+1;
mm = ( mm < 10 ) ? ( "0" + ( mm ).toString() ) : ( mm ).toString();
const fd = "good_"+ [y, mm, "01"].join("_");
module.exports.good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\_good\\"+fd;

/** 
 * OPTIONAL all good folders
 */
module.exports.good_folder_root = "D:\\_Happy_Lesson\\_Going_to_sort\\_good"


/**
 * OPTIONAL where to move file
 */
module.exports.not_good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\_Compressed_"+ y;

module.exports.additional_folder = [
    "D:\\_Happy_Lesson\\_Going_to_sort\\non-h",
    "D:\\_AV\\_Picture",
    "D:\\cache"
];


//----------------- below section used by developer-----------------------------

const path = require('path');

const workspace_name = module.exports.workspace_name = "workspace";

const cache_folder_name= module.exports.cache_folder_name = "cache";

module.exports.folder_list = module.exports.home_pathes.concat(module.exports.good_folder, module.exports.not_good_folder);

if(!module.exports.home_pathes && module.exports.home_pathes.length === 0) {
    throw "need home paths"
}

//wehter to use meaningful file name in cache folder
//or encode they by hash function
module.exports.meaning_cache_folder_name = true;

//in MB
module.exports.oversized_image_size = 4;