const webpack = require("webpack");

function override(config, env) {
  config.resolve.fallback = {
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    assert: require.resolve("assert"),
    http: require.resolve("stream-http"),
    https: require.resolve("https-browserify"),
    os: require.resolve("os-browserify/browser"),
    buffer: require.resolve("buffer"),
    path: require.resolve("path-browserify"),
    vm: require.resolve("vm-browserify"),
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    })
  );

  return config;
}

function devServer(configFunction) {
  return function configureDevServer(proxy, allowedHost) {
    const config = configFunction(proxy, allowedHost);
    const before = config.onBeforeSetupMiddleware;
    const after = config.onAfterSetupMiddleware;

    if (config.https) {
      config.server = { type: "https", options: config.https };
    }

    delete config.onBeforeSetupMiddleware;
    delete config.onAfterSetupMiddleware;
    delete config.https;

    config.setupMiddlewares = (middlewares, server) => {
      const originalUse = server.app.use.bind(server.app);
      const beforeMiddlewares = [];
      const afterMiddlewares = [];

      server.app.use = (...args) => beforeMiddlewares.push(args);
      before(server);
      server.app.use = (...args) => afterMiddlewares.push(args);
      after(server);
      server.app.use = originalUse;

      return [...beforeMiddlewares, ...middlewares, ...afterMiddlewares];
    };

    return config;
  };
}

module.exports = { webpack: override, devServer };
