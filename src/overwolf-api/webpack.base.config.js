const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: [{loader: 'ts-loader'}],
                exclude: /node_modules/,
                
            },
        ],
    },
    resolve: {
        alias: {
            '@template-data': path.resolve(__dirname, 'data_templates'),
            '@data-map': path.resolve(__dirname, 'src/main/config')
        },
        extensions: ['.tsx', '.ts', '.js', '.json'],
        fallback: {
            fs: false,
            path: require.resolve('path-browserify')
        }
    },
    output: {
        path: path.resolve(__dirname, '.webpack/main'),
        filename: '[name]/[name].js',
        clean: true,
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^fsevents$/
        })
    ],
    externals: {
        bufferutil: 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
      },
};