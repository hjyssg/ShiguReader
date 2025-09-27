const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const outputDirectory = 'dist';

const portConfig = require('./src/config/port-config');
const { default_http_port } = portConfig;

const config = {
  entry: ['babel-polyfill', './src/main.jsx'],
  output: {
    path: path.join(__dirname, outputDirectory),
    filename: 'bundle.js',
    publicPath:"/"
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
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
  extensions: ['.js', '.jsx'],
  alias: {
    "@assets": path.resolve(__dirname, 'src/assets/'),
    "@common": path.resolve(__dirname, 'src/common/'),
    "@components": path.resolve(__dirname, 'src/components/'),
    "@api": path.resolve(__dirname, 'src/api/'),
    "@config": path.resolve(__dirname, 'src/config/'),
    "@context": path.resolve(__dirname, 'src/context/'),
    "@name-parser": path.resolve(__dirname, 'src/name-parser/index'),
    "@pages": path.resolve(__dirname, 'src/pages/'),
    "@services": path.resolve(__dirname, 'src/services/'),
    "@styles": path.resolve(__dirname, 'src/styles/'),
    "@utils": path.resolve(__dirname, 'src/utils/'),
  }
};

module.exports = config;
