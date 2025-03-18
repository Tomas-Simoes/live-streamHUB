/* eslint-disable @typescript-eslint/no-var-requires */
const config = require('./webpack.base.config');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const rendererConfig = { ...config };

rendererConfig.target = 'electron-renderer';

rendererConfig.entry = {
  'renderer': './src/renderer/renderer.tsx',
  'preload': './src/preload/preload.ts',
};

rendererConfig.output = { 
    path: path.join(__dirname, '.webpack/renderer'),
    filename: '[name].js',
    clean: true
}

rendererConfig.module.rules.push({
  test: /\.tsx?$/,
  exclude: /node_modules/,
  use: {
    loader: 'ts-loader',
    options: {
      transpileOnly: true
    }
  }
});


rendererConfig.plugins.push(new HtmlWebpackPlugin({
  template: '../frontend/public/index.html',
  filename: 'index.html',
  chunks: ['renderer'],
  publicPath: '',
  inject: true
}));



module.exports = rendererConfig;