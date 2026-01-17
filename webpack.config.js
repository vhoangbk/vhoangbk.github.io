const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { minify } = require('html-minifier-terser');

module.exports = {
  mode: 'production',
  entry: {},
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js',
    assetModuleFilename: 'assets/[hash][ext][query]',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|svg|webp|gif|ico)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.js$/i,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env'] }
        }
      }
    ]
  },
  optimization: {
    minimize: true,
    minimizer: [
      '...',
      new CssMinimizerPlugin()
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: 'public',
          noErrorOnMissing: true,
          globOptions: { dot: true, gitignore: false },
          transform(content, absoluteFrom) {
            if (absoluteFrom.endsWith('.html')) {
              return minify(content.toString(), {
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                minifyJS: true,
                minifyCSS: true,
                collapseBooleanAttributes: true
              });
            }
            return content;
          }
        },
        { from: 'index.js', to: 'index.js', noErrorOnMissing: true },
        { from: 'update-version.js', to: 'update-version.js', noErrorOnMissing: true },
        { from: 'tracking-service.js', to: 'tracking-service.js', noErrorOnMissing: true },
      ]
    }),
  ],
  resolve: {
    extensions: ['.js']
  }
};
