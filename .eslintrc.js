module.exports = {
    env: {
        browser: false,
        es2021: true,
        node: true,
    },
    extends: ["eslint:recommended"],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
    },
    rules: {
        "no-prototype-builtins": "off",
    },
};
