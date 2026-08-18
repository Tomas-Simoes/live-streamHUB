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
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource' 
              }
        ],
    },
    resolve: {
        alias: {
            '@template-data': path.resolve(__dirname, 'data_templates'),
            '@data-map': path.resolve(__dirname, 'src/main/config'),
            '@local-server': path.resolve(__dirname, '../local-server/src')
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
        }),
        new webpack.IgnorePlugin({
            resourceRegExp: /^@nestjs\/microservices(\/microservices-module)?$/
        }),
        new webpack.IgnorePlugin({
            resourceRegExp: /^@nestjs\/websockets\/socket-module$/
        })
    ],
    externals: {
        bufferutil: 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
      },
};
