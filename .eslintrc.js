module.exports = {
    env: {
        browser: false,
        es2021: true,
        node: true,
    },
    extends: ["eslint:recommended"],
    overrides: [
        {
            env: {
                node: true,
            },
            files: [".eslintrc.{js,cjs}"],
            parserOptions: {
                sourceType: "script",
            },
        },
    ],
    rules: {
        "no-prototype-builtins": "off",
    },
};
