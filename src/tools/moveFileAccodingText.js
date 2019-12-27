const fs = require('fs');
const path = require('path');


//temp var
const textFilePath = "C:\\Users\\hjy\\Dropbox\\_Diary\\fap\\good_2017_02_04.txt";
const searchPath =  "D:\\_Happy_Lesson\\_Going_to_sort";
const moveDest = "D:\\temp";

var array = fs.readFileSync(textFilePath, 'utf-8').toString().split('\n');

function moveFilseAccodingText(p){
    const subs = fs.readdirSync(p);
    subs.forEach(singlePath => {
        try {
            const fullPath = path.resolve(p, singlePath);
            const stat = fs.statSync(fullPath);

            if (stat.isFile) {
                //!!! js handle japanese not 100% good
                if(array.includes(singlePath)){
                    console.log(fullPath);
                    fs.renameSync(fullPath, path.join(moveDest, singlePath));
                }
            }else if(stat.isDirectory){
                moveFilseAccodingText(fullPath)
            }
        }catch(e){
            console.error(e);
        }
    });
}

moveFilseAccodingText(searchPath);
console.log("done")
