import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    // 1. Base ESLint Recommended Rules
    eslint.configs.recommended,

    // 2. Configuration for TypeScript Files
    ...tseslint.configs.recommended,
    {
        // Override general configurations for specific file types
        files: ["**/*.ts", "**/*.mts", "**/*.cts"],

        // Add additional rules or environment settings specific to Bun/Node.js environment
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                // Required for some typescript-eslint rules
                project: "./tsconfig.json",
            },
        },
    },

    // 3. Ignore files
    {
        ignores: ["dist/", "node_modules/", "bun.lockb"],
    },
];
