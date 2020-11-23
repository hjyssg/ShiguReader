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






function findToken(){
    const nodes = Array.prototype.slice.call(document.getElementsByClassName("gl1t"));
    if(!nodes  || nodes.length === 0) {
        return;
    }
 

    const result = [



    ];

    nodes.forEach(e => {
        try{
            const subNode = e.getElementsByClassName("gl4t")[0];
            const text = subNode.textContent;
            if(text.includes("翻訳") || text.includes("翻译")){
                return;
            }

            const link = e.querySelector("a").href;

        }catch(e){
            console.error(e);
        }
    });
}



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

async function main() {
    const data = {
        "method": "gdata",
        "gidlist": [
            [618395,"0439fa3666"]
        ],
        "namespace": 1
    }

    const res = await GM_xmlhttpRequestPromise(data);
    
    JSON.parse(res.responseText)

    debugger


    // await findToken(res.allFiles);
}


main();