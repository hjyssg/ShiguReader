const path = require('path');

// module.exports = {
//   mode: 'development', // 指定为开发模式，不进行压缩和混淆
//   entry: './index.js',
//   output: {
//     filename: 'index.js',
//     path: path.resolve(__dirname, 'all_in_one')
//   },
  
// };


module.exports = {
  mode: 'development',
  entry: './index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'all_in_one')
  },
  devtool: 'source-map', // 不使用 eval，而是生成 source map
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
};
