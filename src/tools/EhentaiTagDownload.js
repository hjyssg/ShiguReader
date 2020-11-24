// ==UserScript==
// @name		Ehentai tag download
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @connect     localhost
// @connect api.e-hentai.org
// @namespace       Aji47
// @version			0.0.1
// @description
// @author			Aji47
// @include			*://exhentai.org/*
// @include			*://g.e-hentai.org/*
// @include			*://e-hentai.org/*
// ==/UserScript==


function getCurrentTime(){
    return new Date().getTime();
}

async function GM_xmlhttpRequestPromise(dataObj){
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "POST",
            data: JSON.stringify(dataObj),
            url: "https://api.e-hentai.org/api.php",
            onerror: err => {
                reject(err);
            },
            ontimeout: ()=>{
                reject("timeout");
            },
            onload: res =>{
                resolve(res);
            }
        });
    })
}


//https://stackoverflow.com/questions/6480082/add-a-javascript-button-using-greasemonkey-or-tampermonkey
function addButton(text, onclick, cssObj, id) {
    const defaultCSS = {position: 'fixed', top: '7%', left:'50%', 'z-index': 3, 
                        "background-color": "#57cff7", "color": "white",
                        "padding": "10px", "border": "0px",
                        "font-size": "1rem","font-weight": "bold" }
    cssObj = Object.assign(defaultCSS, cssObj || {} )
    let button = document.createElement('button'), btnStyle = button.style;
    document.body.appendChild(button)
    button.innerHTML = text;
    button.onclick = onclick
    btnStyle.position = 'fixed'; 
    button.id = id;
    Object.keys(cssObj).forEach(key => btnStyle[key] = cssObj[key]);
    return button;
}

//https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
 }

///-------------------------------------------


function findToken(){
    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    if(!nodes  || nodes.length === 0) {
        return;
    }

    const result = [];
    nodes.forEach(e => {
        try{
            const subNode = e.getElementsByClassName("gl4t")[0];
            const text = subNode.textContent;
            if(!text || text.includes("翻訳") || text.includes("翻译")){
                return;
            }
            const link = e.querySelector("a").href;
            result.push({
                title: text,
                link
            })
        }catch(e){
            console.error(e);
        }
    });


    return result;
}


let _stop_download_;

const max_data = 24;

async function doMainTask() {

    stop_download_ = false;

    debugger

    const data = {
        "method": "gdata",
        "gidlist": [],
        "namespace": 1
    }

    const linkAndNameArr = findToken();
    for(let ii = 0; ii < linkAndNameArr.length; ii++){
        e = linkAndNameArr[ii];
        const url = new URL(e.link);
        const tokens = url.pathname.split("/").filter(e => !!e);
        data.gidlist.push([tokens[1], tokens[2]]);
        
        try{
            if(data.gidlist.length > max_data){
                const res = await GM_xmlhttpRequestPromise(data);

                await sleep(1000);
                // JSON.parse(res.responseText)
                data.gidlist = [];
                const str = JSON.stringify(JSON.parse(res.responseText));
                download(getCurrentTime(), str);
            }
        }catch(e){
            debugger
            console.error(e);
        }
    }
}

  

(function() {
    'use strict';
    addButton("download all images", doMainTask, {top: '7%'}, "a-begin-button");

    addButton("stop download", () => { 
        _stop_download_ = true;
        console.log("going to stop...");
    }, {top: '12%'}, "a-stop-button");
})();

