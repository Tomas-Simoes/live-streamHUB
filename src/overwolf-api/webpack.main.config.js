const path = require('path')

module.exports = {
    entry: './src/app.ts',
    target: 'electron-main',
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                include: path.resolve(__dirname, 'src'),
                use: [{loader: 'ts-loader'}],
                //exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            fs: false,
            path: require.resolve('path-browserify')
        }
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, '.webpack/main'),
        clean: true,
    },
};