const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");

module.exports = {
  entry: "./src/index.ts",

  devtool: 'inline-source-map',

  devServer: {
    static: './public',
    open: true,
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "public"),
    clean: true,
    assetModuleFilename: "assets/[hash][ext][query]",
  },

  plugins: [
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      minify: true,
      meta: {
        viewport: "width=device-width, initial-scale=1"
      },
      favicon: "./src/images/favicon.ico"
    }),
    new ImageMinimizerPlugin({
      minimizer: {
        implementation: ImageMinimizerPlugin.imageminGenerate,
        options: {
          plugins: [
            ["imagemin-jpeg-recompress", { quality: "medium" }],
            ["pngquant", { quality: [0.6, 0.8] }],
          ],
        },
      },
    })
  ],

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"]
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: "asset/resource",
        generator: {
          filename: "images/[hash][ext][query]"
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
        generator: {
          filename: "fonts/[hash][ext][query]"
        }
      },
      {
        test: /\.html$/,
        use: ["html-loader"]
      },
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ]
  },

  mode: "development", // 'production'
};
