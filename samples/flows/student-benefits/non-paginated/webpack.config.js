const path = require('path');

module.exports = (env, args) => {
    const isProduction = args && args['mode'] === 'production';

    const config = {
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: "bundle.js",
        },
        resolve: {
            extensions: [".tsx", ".ts", ".js", ".json"]
        },
        module: {
            rules: [
                { test: /\.tsx?$/, use: ["ts-loader"], exclude: /node_modules/ },
            ],
        },
    };

    if (isProduction) {
        config.mode = "production";
        config.entry = "./src/index.tsx";
    } else {
        config.mode = "development";
        config.entry = './debug/debug.tsx';
        config.devtool = "source-map";
        config.devServer = {
            port: 8081,
            client: {
                overlay: {
                    errors: true,
                    warnings: false,
                },
            },
        };
    }

    return config;
};