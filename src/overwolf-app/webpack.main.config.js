const path = require('path')
const config = require('./webpack.base.config')

const mainConfig = { ...config }
mainConfig.target = 'electron-main'
mainConfig.entry = {
    'index': './src/main/index.ts'
}

mainConfig.output = { 
    path: path.join(__dirname, '.webpack/main'),
    filename: '[name].js',
    clean: true
}

module.exports = mainConfig