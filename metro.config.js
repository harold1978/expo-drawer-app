// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Habilita soporte para CommonJS de Firebase en el bundler web
config.resolver.sourceExts.push('cjs');

module.exports = config;
