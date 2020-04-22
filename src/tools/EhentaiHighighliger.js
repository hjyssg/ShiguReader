// ==UserScript==
// @name			EhentaiLight配合Shigureader
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// @connect     localhost
// @namespace       Aji47
// @version			0.0.1
// @description
// @author			Aji47
// @include			*://exhentai.org/g/*
// @include			*://g.e-hentai.org/g/*
// ==/UserScript==

//用于tempermonkey

function googleTranslate() {
    var api = 'http://localhost:8080/api/getGoodAuthorNames';
    GM_xmlhttpRequest({
        method: "GET",
        url:api,
        onload: function(dom) {
           const res = JSON.parse(dom.responseText);
           res.goodAuthors
           res.otherAuthors
        }
    });
}

googleTranslate()