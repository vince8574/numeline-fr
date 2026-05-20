const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.NODE_ENV === 'production') {
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      keep_classnames: false,
      keep_fnames: false,
      mangle: {
        toplevel: true,
      },
      compress: {
        drop_console: true,
        drop_debugger: true,
        reduce_vars: true,
        collapse_vars: true,
        conditionals: true,
        dead_code: true,
        unused: true,
      },
      output: {
        comments: false,
        beautify: false,
      },
    },
  };
}

module.exports = config;
