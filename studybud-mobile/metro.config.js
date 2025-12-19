const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude test files from bundle (safe optimization)
config.resolver = {
    ...config.resolver,
    blacklistRE: /(.*\/__tests__\/.*|.*\.test\.[jt]sx?|.*\.spec\.[jt]sx?)$/,
    sourceExts: [...config.resolver.sourceExts, 'cjs'],
};

module.exports = config;
