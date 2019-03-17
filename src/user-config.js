'use strict';

/**
 * MUST Where ShiguReader will scan files 修改成本地存放漫画zip的路径
 */
module.exports.home_pathes = ["T:\\迅雷下载", "D:\\_Happy_Lesson", "D:\\_Happy_Lesson\\_Unread", "D:\\_Happy_Lesson\\_Going_to_sort", "E:\\_Temp_Music"];

/** 
 * OPTIONAL where to move file
 */
module.exports.good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\good_2019_03_01";

/**
 * OPTIONAL where to move file
 */
module.exports.not_good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\_Compressed_3";


//----------------- below section used by developer-----------------------------
module.exports.cache_folder_name = "cache";

module.exports.folder_list = module.exports.home_pathes.concat(module.exports.good_folder, module.exports.not_good_folder);

if(!module.exports.home_pathes && module.exports.home_pathes.length === 0) {
    throw "need home paths"
}


