module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Nothing may be logged: logs can end up in crash reports and device
    // logs, and must never carry a phrase, key or address.
    'no-console': 'error',
  },
};
