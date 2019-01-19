const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const allfl = require('./node-filelist');
const _7z = require('7zip')['7z'];
const {spawn} = require('child-process-promise');
var iconv = require('iconv-lite');

const userConfig = {};
userConfig.pathes = ["C:\\__"];
const pathes = userConfig.pathes;

//https://www.npmjs.com/package/node-7z#options

const option  = { "ext" : "zip|rar" };

const root = path.join(__dirname, "..\\..\\..");
const cachePath = path.join(__dirname, "..\\..\\cache");

// const cachePath = path.join("C:\\cache");


const app = express();
const db = {};
const file2content = [];

app.use(express.static('dist'));
app.use(express.static(root));

//to consume json request body
//https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

const imageTypes = ["jpg", "png"];
const compressTypes = ["zip", "rar"];

function isImage(fn){
	return imageTypes.some((e)=> fn.endsWith(e));
}

function isCompress(fn){
	return compressTypes.some((e)=> fn.endsWith(e));
}

allfl.read(pathes, {}, function (results){
	const arr = [];
	for(var i=0; i< results.length; i++){
		const p = results[i].path;
		const ext = path.extname(p).toLowerCase();
		if(!ext || isCompress(ext)){
			arr.push(p);
		}
	}
	db.allFiles = arr;
});

//http://localhost:8080/api/home
app.get('/api/home', (req, res) => {
	res.send({dirs: userConfig.pathes});
});

app.post('/api/lsDir', (req, res)=>{
	const dir = req.body && req.body.dir;
	if (!dir){
		res.send(404);
	}

	//todo
	fs.readdir(dir,  function (error, results){
		const files = [];
		const dirs = [];
		for(var i=0; i< results.length; i++){
			const p = results[i];
			const ext = path.extname(p).toLowerCase();
			if(!ext){
				dirs.push(path.join(dir, p));
			}else if(isImage(ext) || isCompress(ext)) {
				files.push(path.join(dir, p));
			}
		}
		res.send({dirs, files});
	});
});

function read7zOutput(data){
	const lines = data && data.split("\n");
	const BEG = 52; //by 7zip
	const files = [];

	for(let ii = 0; ii < lines.length; ii++){
		let line = lines[ii];
		if(line && line.length > BEG){
			line = line.slice(BEG, line.length-1);
			if(isImage(line) || isCompress(line)){
				files.push(line.trim());
			}
		}
	}

	return files;
}

//!!need to set windows console to utf8 
app.post('/api/firstImage', (req, res) => {
	const fileName = req.body && req.body.fileName;
	if (!fileName){
		res.send(404);
	}

	//assume zip
	var getList = spawn(_7z, ['l', '-ba', fileName], { capture: [ 'stdout', 'stderr' ]});

	getList.then(function (data) {
		//parse 7zip output
		data = data.stdout;
		if(!data){
			res.send("404 fail");
		}

		const files = read7zOutput(data);

		if(!files[0]){
			res.send(404);
		}

		const outputFolder =  path.basename(fileName, path.extname(fileName));
		const outPath = path.join(cachePath, outputFolder);
		const one =  files[0];
		//Overwrite mode
		var opt = ['x', fileName, '-o'+ outPath, one, "-aos"];
		var getFirst = spawn(_7z, opt, { capture: [ 'stdout', 'stderr' ]});
		var childProcess = getFirst.childProcess;
		childProcess.on("close", function(code){
			console.log('[spawn] exit: ', code);
			if(code === 0){
				//send path to client
				let temp = path.join("cache", path.basename(outPath), one);
				temp = temp.replace(new RegExp('\\' + path.sep, 'g'), '/');
				res.send({image: temp})
			}else{
				res.send(404)
			}
		})

		// console.log('[spawn] childProcess.pid: ', childProcess.pid);
		// childProcess.stdout.on('data', function (data) {
		// 	console.log('[spawn] stdout: ', data.toString());
		// });
		// childProcess.stderr.on('data', function (data) {
		// 	console.log('[spawn] stderr: ', data.toString());
		// });

		// getFirst.then('data', function (data) {
		// 	data = data.stdout;
		// 	console.log('extract: ' + data);
		// 	res.send(data);
		// }).catch(function (data) {
		// 	console.log('when extracting, received a error: ' + data);
		// 	res.send("7zip error");
		// });
	})
	
	.catch(function (data) {
	    console.log('when list content, received a error: ' + data);
	    res.send(404);
	});
})

// http://localhost:8080/api/extract
app.get('/api/extract', (req, res)=>{
	//https://medium.freecodecamp.org/node-js-child-processes-everything-you-need-to-know-e69498fe970a
	const fileName = 'C:\\__\\aaa.zip';
	if (!fileName){
		res.send(404);
	}

	const outPath = path.join(cachePath, path.basename(fileName, path.extname(fileName)));

	var all = ['x', fileName, '-o'+ outPath];

	var task = spawn(_7z, all, { capture: [ 'stdout', 'stderr' ]});
	task.then('data', function (data) {
		data = data.stdout;
	    console.log('extract: ' + data);
  		res.send(data);
	}).catch(function (data) {
	    console.log('We received a error: ' + data);
	    res.send("7zip error");
	});
});


app.listen(8080, () => console.log('Listening on port 8080!'));
