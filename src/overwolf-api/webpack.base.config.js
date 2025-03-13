const path = require('path')

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
    plugins: [],
    externals: {
        bufferutil: 'bufferutil',
        'utf-8-validate': 'utf-8-validate',
      },
};