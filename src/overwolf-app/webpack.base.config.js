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
            {
                test: /\.css?$/,
                use: ['style-loader', 'css-loader']
            }
        ],
    },
    resolve: {
        alias: {
            '@template-data': path.resolve(__dirname, 'data_templates'),
            '@data-map': path.resolve(__dirname, 'src/main/config'),
            '@frontend': path.resolve(__dirname, '../frontend')
        },
        extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
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