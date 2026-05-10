const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Polyfills for @solana/web3.js in React Native
config.resolver.extraNodeModules = {
  buffer: require.resolve("buffer"),
  url: require.resolve("react-native-url-polyfill"),
};

// Redirect @solana-mobile MWA to a stub so TurboModuleRegistry.getEnforcing
// is never called in Expo Go (which lacks the SolanaMobileWalletAdapter native module).
// EAS Build sets EAS_BUILD=true — in that environment the real native module is
// present, so we skip the stub and let Metro resolve the real packages.
if (!process.env.EAS_BUILD) {
  const MWA_STUB = path.resolve(__dirname, "stubs/mwa.js");
  const MWA_PACKAGES = new Set([
    "@solana-mobile/mobile-wallet-adapter-protocol",
    "@solana-mobile/mobile-wallet-adapter-protocol-web3js",
  ]);

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (MWA_PACKAGES.has(moduleName)) {
      return { filePath: MWA_STUB, type: "sourceFile" };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
