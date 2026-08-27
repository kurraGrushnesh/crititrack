module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "script",
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double", {allowTemplateLiterals: true}],
    "prefer-arrow-callback": "error",
    // Style-only rules from eslint-config-google that we do not want to
    // block a deploy on:
    "max-len": "off",
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "new-cap": ["error", {capIsNew: false}],
    "object-curly-spacing": "off",
    "indent": "off",
    "operator-linebreak": "off",
    "no-restricted-globals": ["error", "length"],
  },
  overrides: [
    {
      files: ["**/*.spec.*", "**/*.test.*"],
      env: {mocha: true},
      rules: {},
    },
  ],
};
