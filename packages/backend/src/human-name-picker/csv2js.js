// 预处理脚本
// 一个js脚本，把读取的csv的转换成js文件。这样别的文件使用，可以直接import js文件。

const fs = require('fs');
const path = require('path');
const csv = require('csvtojson');

// 读取 CSV 文件并转换为 JSON 数据
function do_csv2js_on_one_file(fn){
  csv()
  .fromFile(`${fn}.csv`)
  .then((jsonObj) => {
    // 将 JSON 数据写入 JS 文件
    const jsContent = `module.exports = ${JSON.stringify(jsonObj)};`;
    fs.writeFileSync(path.resolve(__dirname, `${fn}.js`), jsContent);
  });
}

do_csv2js_on_one_file("av_tag_list");
do_csv2js_on_one_file("cos_tag_list");
