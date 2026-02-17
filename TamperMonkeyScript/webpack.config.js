const path = require("path");
const webpack = require("webpack");

const metadata = `// ==UserScript==\n`
  + `// @name        EhentaiLight配合Shigureader\n`
  + `// @grant       GM_addStyle\n`
  + `// @grant       GM_getValue\n`
  + `// @grant       GM_setValue\n`
  + `// @grant       GM_getResourceText\n`
  + `// @connect     localhost\n`
  + `// @namespace       Aji47\n`
  + `// @version         0.0.31\n`
  + `// @description\n`
  + `// @author        Aji47\n`
  + `// @include       *://exhentai.org/*\n`
  + `// @include       *://g.e-hentai.org/*\n`
  + `// @include       *://e-hentai.org/*\n`
  + `// @include       *://sukebei.nyaa.si/*\n`
  + `// @include       *://sukebei.nyaa.si\n`
  + `// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11.7.5/dist/sweetalert2.all.min.js\n`
  + `// ==/UserScript==\n`;

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "src", "EhentaiHighighliger.js"),
  output: {
    filename: "EhentaiHighighliger.user.js",
    path: path.resolve(__dirname),
  },
  target: "web",
  devtool: false,
  optimization: {
    minimize: false,
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: metadata,
      raw: true,
    }),
  ],
};
