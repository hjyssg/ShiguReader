const express = require('express');
const os = require('os');
const path = require('path');
const fl = require('./node-filelist');
const _7z = require('7zip')['7z'];
const {spawn} = require('child-process-promise');

const userConfig = {};
userConfig.pathes = ["C:\\__"];
const pathes = userConfig.pathes;

//https://www.npmjs.com/package/node-7z#options

const option  = { "ext" : "zip|rar" };

const root = path.join(__dirname, "..\\..\\..");
const cachePath = path.join(__dirname, "..\\..\\cache");

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

fl.read(pathes, {}, function (results){
	const arr = [];
	for(var i=0; i< results.length; i++){
		const p = results[i].path;
		const ext = path.extname(p).toLowerCase();
		if(!ext || isImage(ext) || isCompress(ext)){
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
	fl.read([dir], {}, function (results){
		const files = [];
		const dirs = [];
		for(var i=0; i< results.length; i++){
			const p = results[i].path;
			const ext = path.extname(p).toLowerCase();
			if(!ext){
				dirs.push(p);
			}else if(isImage(ext) || isCompress(ext)) {
				files.push(p);
			}
		}
		
		res.send({dirs, files});
	});
});

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
			res.send("404 fail to ");
		}
		lines = data && data.split("\n");
		
		const PRE = 10; //by me
		const BEG = 52; //by 7zip
		const files = [];

		for(let ii = 0; files.length < PRE && ii < lines.length; ii++){
			let line = lines[ii];
			if(line && line.length > BEG){
				line = line.slice(BEG, line.length-1);
				if(isImage(line) || isCompress(line)){
					files.push(line.slice(BEG))
				}
			}
		}

		data = data && data.slice(50);

		const ouputPath = path.join(cachePath, path.basename(fileName, path.extname(fileName)));
		const thumbnai = data && data[0];
		var opt = ['e', fileName, '-o'+ ouputPath, thumbnai, "-r"];
		var getFirst = spawn(_7z, opt, { capture: [ 'stdout', 'stderr' ]});
		getFirst.then('data', function (data) {
			data = data.stdout;
			console.log('extract: ' + data);
			res.send(data);
		}).catch(function (data) {
			console.log('when extracting, received a error: ' + data);
			res.send("7zip error");
		});

	}).catch(function (data) {
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

	const ouputPath = path.join(cachePath, path.basename(fileName, path.extname(fileName)));

	var all = ['x', fileName, '-o'+ ouputPath];

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
