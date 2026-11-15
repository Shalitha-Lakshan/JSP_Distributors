const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable wasm support for expo-sqlite web compatibility
config.resolver.assetExts.push('wasm');

module.exports = config;

