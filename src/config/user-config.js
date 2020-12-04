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
 * OPTIONAL where to move file
 * 可选 手动漫画整理的时候，你想把不怎么喜欢的漫画移动到的位置
 */
module.exports.not_good_folder = "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\_Compressed_"+ y;

/** 
 * OPTIONAL all good folders  
 * 可选 喜欢的漫画的根目录，这个文件夹会用来判断你的喜好
 */
module.exports.good_folder_root = "D:\\_Happy_Lesson\\_Going_to_sort\\_good"

/** 
 * OPTIONAL all good folders  
 * 可选 不怎么喜欢的漫画的根目录，这个文件夹会用来判断你的喜好
 */
module.exports.not_good_folder_root = "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good"

/**
 * OPTIONAL where to move file
 * 可选 手动漫画整理的时候，你可以移动的其他位置
 */
module.exports.additional_folder = [
    "D:\\_Happy_Lesson\\_Going_to_sort\\non-h",
    "D:\\_AV\\_Picture",
    "D:\_AV",
    "E:\\_Temp_Music",
    "E:\\_temp_comic",
];


//----------------- below section used by developer-----------------------------

module.exports.workspace_name = "workspace";
 
module.exports.cache_folder_name = "cache";

module.exports.thumbnail_folder_name = "thumbnails";

module.exports.img_convert_cache = "image_convert_cache"

module.exports.zip_output_cache = "zip_output";

//delete or move to recyle bin
//删除操作是真的彻底删除还是丢进回收站
module.exports.move_file_to_recyle = true;

//wehter to use meaningful file name in cache folder
//or encode they by hash function
module.exports.readable_cache_folder_name = true;

//漫画阅读中两页clip在一起以后，翻页是不是还要接着拼在一起
//wether to clip page
module.exports.keep_clip = false;

//漫画阅读中调整图片比例以后，翻页是不是还要保存
//wether to save zoom scale
module.exports.keep_zoom_scale = false;

//非localhost的机器想移动删除文件，需要在admin输出密码才可以获得权限
//并不是高明的安全机制
//注：Shigureader设计实现，只考虑在LAN情况下的性能和安全性。
//Naive password when access remotely
module.exports.file_change_password = "2020";

//----------------------------image compress parameter-------------------------------------------------

//in MB, only for website UI display
module.exports.oversized_image_size = 4;

// the algo is as following
// size <= img_convert_min_threshold: do not minify
// img_convert_min_threshold < size < img_convert_huge_threshold: image compress
// img_convert_huge_threshold <= size: image compress and reduce resolution

//压缩图片的时候用的参数 传给magick用的
//magick compress output quality for huge file
module.exports.img_convert_quality = 60;

//magick compress output quality for middle-size file
module.exports.img_convert_quality_for_middle_size_file = 70;

//超过这个大小，再转换的时候同时压低分辨率。
//现在太多漫画，扫描出来一来4000*6000。完全没有必要
module.exports.img_convert_huge_threshold = 6 ; //in MB

//小于这个大小，没有转换的必要
module.exports.img_convert_min_threshold = 1.5; //in MB

// output file format
module.exports.img_convert_dest_type = ".jpg";

//Only Shrink huge Images ('>' flag)
//参考资料:http://www.imagemagick.org/Usage/resize/#shrink
//不必担心，会保持比例，高宽都低于规定的比例。
module.exports.img_reduce_resolution_dimension = "2800x2800";



//---------------------------------------------------------------------------------------

//uses can view folder that has images as a zip
//so users do not have zip their manga
//But this may cause more Memory usage
//可以阅读文件夹的图片，就不需要打包成zip
//但可能用很多内存
module.exports.view_img_folder = true;


//global password
//when set, user need to enter password to use ShiguReader
//全局密码，设置以后用户必须输入密码才能打开网站
module.exports.home_password = ""

//do not display a zip if it has no image files or music files
module.exports.filter_empty_zip = true;