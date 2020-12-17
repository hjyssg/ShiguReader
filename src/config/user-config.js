'use strict';

const config = {};

//----------------- below section used by developer-----------------------------

config.workspace_name = "workspace";

config.cache_folder_name = "cache";

config.thumbnail_folder_name = "thumbnails";

config.img_convert_cache = "image_convert_cache"

config.zip_output_cache = "zip_output";

//delete or move to recyle bin
//删除操作是真的彻底删除还是丢进回收站
config.move_file_to_recyle = true;

//wehter to use meaningful file name in cache folder
//or encode they by hash function
config.readable_cache_folder_name = true;

//漫画阅读中两页clip在一起以后，翻页是不是还要接着拼在一起
//wether to clip page
config.keep_clip = false;

//漫画阅读中调整图片高宽比例以后，翻页是否还要保存
//wether to keep zoom scale
config.keep_zoom_scale = false;

//----------------------------image compress parameter-------------------------------------------------

//in MB, only for website UI display
config.oversized_image_size = 4;

// the algo is as following
// size <= img_convert_min_threshold: do not minify
// img_convert_min_threshold < size < img_convert_huge_threshold: image compress
// img_convert_huge_threshold <= size: image compress and reduce resolution

//压缩图片的时候用的参数 传给magick用的
//magick compress output quality for huge file
config.img_convert_quality = 60;

//magick compress output quality for middle-size file
config.img_convert_quality_for_middle_size_file = 70;

//超过这个大小，再转换的时候同时压低分辨率。
//现在太多漫画，扫描出来一来4000*6000。完全没有必要
config.img_convert_huge_threshold = 6; //in MB

//小于这个大小，没有转换的必要
config.img_convert_min_threshold = 1.5; //in MB

// output file format
config.img_convert_dest_type = ".jpg";

//Only Shrink huge Images ('>' flag)
//参考资料:http://www.imagemagick.org/Usage/resize/#shrink
//不必担心，会保持比例，高宽都低于规定的比例。
config.img_reduce_resolution_dimension = "2800x2800";


//---------------------------------------------------------------------------------------
//uses can view folder that has images as a zip
//so users do not have zip their manga
//But this may cause more Memory usage
//可以阅读文件夹的图片，就不需要打包成zip
//但可能用很多内存
config.view_img_folder = true;

//global password
//when set, user need to enter password to use ShiguReader
//全局密码，设置以后用户必须输入密码才能打开网站
config.home_password = ""

//do not display a zip if it has no image files or music files
config.filter_empty_zip = true;

//------------------------------------------------------------------
module.exports = config;
