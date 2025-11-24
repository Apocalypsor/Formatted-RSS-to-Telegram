// Bun test configuration to replace jest.config.js
export default {
    // Test file patterns
    testMatch: ["**/*.spec.ts", "**/*.test.ts"],
    
    // Module path aliases (matching tsconfig.json paths)
    moduleNameMapper: {
        "^@services/(.*)$": "<rootDir>/src/services/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@config/(.*)$": "<rootDir>/src/config/$1",
        "^@consts/(.*)$": "<rootDir>/src/consts/$1",
        "^@database/(.*)$": "<rootDir>/src/database/$1",
        "^@errors/(.*)$": "<rootDir>/src/errors/$1",
        "^@config$": "<rootDir>/src/config",
        "^@services": "<rootDir>/src/services",
    },
};
