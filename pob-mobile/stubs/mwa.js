// Stub used in Expo Go — MWA TurboModule is not available.
// When doing a real dev build (npx expo run:android), remove the
// resolveRequest override in metro.config.js to use the real package.
module.exports = {
  transact: async (_callback) => {
    throw new Error(
      "Wallet connect requires a development build.\nRun: npx expo run:android"
    );
  },
};
