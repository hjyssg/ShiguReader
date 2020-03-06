const execa = require('execa');
const fs = require('fs');
const path = require('path');
const unzip_cache = "unzip_cache";
const compress_cache = "compress_cache";
const pfs = require('promise-fs');

const util = require("../util");
const sevenZip = require('../7zip')['7z'];

const isExist = async (path) => {
    try{
        const error = await pfs.access(path);
        return !error;
    }catch(e){
        return false;
    }
};

async function main (){
    const fileName = "C:\\[モノリノ] PINKERTON.zip" 
    //must conver name into number, I dont know why
    const f = "111221"; // path.basename(fileName, path.extname(fileName));
    const unzipPath = path.join(__dirname, unzip_cache, f);
    const reducedPathEntry = path.join(__dirname, compress_cache);
    const reducedPath =  path.join(__dirname, compress_cache, f);

    const all = ['e', fileName, `-o${unzipPath}`, "-aos"];
    const {stdout, stderr} = await execa(sevenZip, all);
    if (!stderr) {
        if(!(await isExist(reducedPathEntry))){
            err = await pfs.mkdir(reducedPathEntry);
        }

        if(!(await isExist(reducedPath))){
            err = await pfs.mkdir(reducedPath);
        }

        compressImages(unzipPath, reducedPath);

    } else {
        console.log(stderr)
    }
}

function compressImages(unzipPath, reducedPath){
    const INPUT_path_to_your_images = (unzipPath+'/*').replace(/\\/g, "/");
    // const INPUT_path_to_your_images = (unzipPath+'/001.jpg').replace(/\\/g, "/");
    const imagemin = require('imagemin');
    //npm install not enough, you need to go node_modules and manually download exe file!!
    const imageminJpegRecompress = require('imagemin-jpeg-recompress');   //compression rate 0.66
    (async () => {
        const files = await imagemin([INPUT_path_to_your_images], {
            destination: reducedPath.replace(/\\/g, "/"),
            plugins: [
                imageminJpegRecompress()
            ]
        });
        console.log(files);
    })();
}

main();