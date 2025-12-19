const path = require('path');

module.exports = {
  mode: 'production',
  // This is the file we created that wraps the React component
  entry: './src/vanilla-entry.js', 
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'moorhen.js',
    library: 'moorhen', // This creates window.moorhen
    libraryTarget: 'umd',
    globalObject: 'this', // Important for UMD compatibility
    clean: true, // Cleans the dist folder before building
  },
  module: {
    rules: [
      {
        // Handle TypeScript and JavaScript files
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }],
              '@babel/preset-typescript' // Necessary for .ts/.tsx files
            ]
          }
        }
      },
      {
        // Handle SASS/SCSS files (Fixes the @use 'index.scss' error)
        test: /\.s[ac]ss$/i,
        use: [
          "style-loader", // Injects styles into DOM
          "css-loader",   // Reads CSS files
          "sass-loader",  // Compiles SASS to CSS
        ],
      },
      {
        // Handle standard CSS files
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        // Handle SVGs (Moorhen uses many icons)
        test: /\.svg$/,
        use: ['@svgr/webpack', 'url-loader'],
      }
    ]
  },
  resolve: {
    // Tells Webpack to look for these extensions
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    
    // Webpack 5 polyfill fix for Emscripten/Wasm
    fallback: {
      fs: false,
      path: false,
      crypto: false
    }
  },
  // Hide warnings about large bundle sizes since Moorhen is naturally large
  performance: {
    hints: false
  }
};