const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const outputDirectory = 'dist';

const portConfig = require('./src/config/port-config');
const { default_http_port } = portConfig;

const config = {
  entry: ['babel-polyfill', './src/client/index.js'],
  output: {
    path: path.join(__dirname, outputDirectory),
    filename: 'bundle.js',
    publicPath:"/"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        // loader: 'url-loader?limit=100000'
        use:[
          {
              loader: 'url-loader',
              options: {
                  limit: 1000,
              }
          }
      ]

      },{
        test: /\.scss$/,
        use: ["style-loader", "css-loader", {
          loader: 'sass-loader',
          options: {
            implementation: require('dart-sass'),
          },
        }]
      },{
        test: /\.less$/,
        use: ["style-loader" ,"css-loader", "less-loader"]
      }
    ]
  },
  devServer: {
    open: true,
    host: '0.0.0.0',
    allowedHosts: "all",
    historyApiFallback: true,
    hot: false,
    proxy: {
      '/api': `http://127.0.0.1:${default_http_port}`
    },
    static: [{
      directory: path.join(__dirname, 'public'),
      publicPath:"/"
    },{
      directory: path.join(__dirname, 'resource'),
      publicPath:"/"
    },
    {
      directory: __dirname,
      publicPath:"/"
    }],
    port: 9000,
  },
  plugins: [
    // new CleanWebpackPlugin([outputDirectory]),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      favicon: './public/favicon-96x96.png'
    })
  ]
};

config.resolve = {
  alias: {
    "@common": path.resolve(__dirname, 'src/common/'),
    "@config": path.resolve(__dirname, 'src/config/'),
    "@name-parser": path.resolve(__dirname, 'src/name-parser/index'),
  }
}

module.exports = config;
