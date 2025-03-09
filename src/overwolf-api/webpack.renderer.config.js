const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    entry: './src/renderer.ts',
    target: 'electron-renderer',
    mode: 'development',
    module: {
        rules: [
            {
            test: /\.ts$/,
            include: path.resolve(__dirname, 'src'),
            use: 'ts-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: 'renderer.js',
        path: path.resolve(__dirname, '.webpack/renderer'),
        clean: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Overwolf API",
            template: path.resolve(__dirname, 'src/renderer/index.html'),
            filename: 'index.html'
        })
    ]
}