const sqlite3 = require('better-sqlite3');

// 打开数据库文件
const db = new sqlite3('backup_file_db.db', { verbose: console.log });



const text = "good";
const start1 = Date.now();


// const stmt = db.prepare('SELECT * FROM file_table WHERE fileName LIKE ? or dirName LIKE ?');
// const rows = stmt.all(`%${text}%`, `%${text}%`);


let stmt = db.prepare(`SELECT tag, MAX(subtype) AS subtype,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
                COUNT(filePath) AS total_count
                FROM author_view GROUP BY tag`);
let rows = stmt.all(`Y:\\_Happy_Lesson\\_Going_to_sort\\_good`, `Y:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\`);


stmt = db.prepare(`SELECT tag, MAX(subtype) AS subtype,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
                COUNT(filePath) AS total_count
                FROM author_view GROUP BY tag`);
rows = stmt.all(`Y:\\_Happy_Lesson\\_Going_to_sort\\_good`, `Y:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\`);


console.log(rows.length);
const end1 = Date.now();



// // 输出各段查询用时
console.log(`第一段查询用时：${end1 - start1}ms`);


// 关闭数据库连接
db.close();


// (184+186+186) / (281+292+273) 
// 性能相较于node-sqlite提升了50% 
// 并不值得更换，失去了async，没有concurrency了
