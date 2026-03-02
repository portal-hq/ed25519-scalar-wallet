const webpack = require("webpack");

module.exports = {
  webpack: function override(config, env) {
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
  },
  devServer: function (configFunction) {
    return function (proxy, allowedHost) {
      const config = configFunction(proxy, allowedHost);

      const {
        onAfterSetupMiddleware,
        onBeforeSetupMiddleware,
        https: httpsConfig,
        ...rest
      } = config;

      const patched = {
        ...rest,
        setupMiddlewares(middlewares, devServer) {
          if (onBeforeSetupMiddleware) {
            onBeforeSetupMiddleware(devServer);
          }
          if (onAfterSetupMiddleware) {
            onAfterSetupMiddleware(devServer);
          }
          return middlewares;
        },
      };

      if (httpsConfig) {
        patched.server =
          typeof httpsConfig === "object"
            ? { type: "https", options: httpsConfig }
            : { type: "https" };
      }

      return patched;
    };
  },
};
