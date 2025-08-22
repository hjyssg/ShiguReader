const path = require('path');
const nodeExternals = require('webpack-node-externals');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  // Mode can be 'development' or 'production'
  mode: 'production',

  // Entry point of the application
  entry: './src/server/index.js',

  // Target node environment
  target: 'node',

  // Exclude node_modules from the bundle.
  // This is the standard and most reliable way to handle back-end bundling.
  // The node_modules folder will need to be distributed alongside the build output.
  externals: [nodeExternals()],

  // Output configuration
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'main.js',
  },

  // Plugins
  plugins: [
    // As determined before, large assets will be handled by the developer
    // during the packaging stage, not during the build.
    new CopyWebpackPlugin({
      patterns: [
        { from: 'dist', to: 'dist', noErrorOnMissing: true },
      ],
    }),
  ],

  // Make sure __dirname and __filename work as expected
  node: {
    __dirname: false,
    __filename: false,
  },

  // No special loaders needed for this configuration
  module: {
    rules: [],
  },

  resolve: {
    extensions: ['.js'],
  },
};
