'use strict';

/** 
 * OPTIONAL where to move goods files  
 * 可选 手动漫画整理的时候，你想把喜欢的漫画移动到的位置
 */
const now = new Date();
const y = now.getFullYear();
let mm = now.getMonth()+1;
mm = ( mm < 10 ) ? ( "0" + ( mm ).toString() ) : ( mm ).toString();
const fd = "good_"+ [y, mm, "01"].join("_");
module.exports.good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\_good\\"+fd;

/** 
 * OPTIONAL all good folders  
 * 可选 喜欢的漫画的根目录，这个文件夹可以会用来判断你喜欢什么作评
 */
module.exports.good_folder_root = "D:\\_Happy_Lesson\\_Going_to_sort\\_good"


/**
 * OPTIONAL where to move file
 * 可选 手动漫画整理的时候，你想把不怎么喜欢的漫画移动到的位置
 */
module.exports.not_good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\_Compressed_"+ y;

/**
 * OPTIONAL where to move file
 * 可选 手动漫画整理的时候，你可以移动的其他位置
 */
module.exports.additional_folder = [
    "D:\\_Happy_Lesson\\_Going_to_sort\\non-h",
    "D:\\_AV\\_Picture",
    "D:\\cache"
];


//----------------- below section used by developer-----------------------------

module.exports.workspace_name = "workspace";
 
module.exports.cache_folder_name = "cache";

module.exports.img_convert_cache = "image_convert_cache"

//ipad iphone上面看漫画是一页一张图，还是一次显示全部整本的全部图片
module.exports.onebook_only_image_per_page = true;

//delete or move to recyle bin
//删除操作是真的彻底删除还是丢进回收站
module.exports.move_file_to_recyle = true;

//wehter to use meaningful file name in cache folder
//or encode they by hash function
module.exports.readable_cache_folder_name = true;

//漫画阅读中两页clip在一起以后，翻页是不是还要接着拼在一起
module.exports.keep_clip = false;

//in MB
module.exports.oversized_image_size = 4;

//非localhost的机器想移动删除文件，需要在admin输出密码才可以获得权限
//并不是高明的安全机制
//注：Shigureader设计实现，只考虑在LAN情况下的性能和安全性。
module.exports.file_change_password = "2020";

//压缩图片的时候用的参数
//传给magick用的
module.exports.img_convert_quality = 50;