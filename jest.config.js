module.exports = {
  preset: '@react-native/jest-preset',
  // These packages ship as ES modules, so Jest has to transpile them too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@scure|@noble)/)',
  ],
};
