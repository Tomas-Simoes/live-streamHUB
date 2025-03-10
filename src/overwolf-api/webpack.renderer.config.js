/* eslint-disable @typescript-eslint/no-var-requires */
const config = require('./webpack.base.config');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const rendererConfig = { ...config };

rendererConfig.target = 'electron-renderer';

rendererConfig.entry = {
  'renderer': './src/renderer/renderer.ts',
  'preload': './src/preload/preload.ts',
};

rendererConfig.output = { 
    path: path.join(__dirname, '.webpack/renderer'),
    filename: '[name].js',
    clean: true
}

rendererConfig.plugins.push(new HtmlWebpackPlugin({
  template: './src/renderer/index.html',
  filename: path.join(__dirname, '.webpack/renderer/index.html'),
  chunks: ['renderer'],
  publicPath: '',
  inject: false
}));

module.exports = rendererConfig;