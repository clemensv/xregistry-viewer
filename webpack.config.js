const path = require('path');

module.exports = {
  resolve: {
    extensions: [".svg"],
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        include: [
          path.resolve(__dirname, 'node_modules/@fluentui/svg-icons')
        ],
        use: [
          {
            loader: "svg-inline-loader",
            options: {
              removeSVGTagAttrs: false,
            },
          },
        ],
      }
    ]
  }
};
