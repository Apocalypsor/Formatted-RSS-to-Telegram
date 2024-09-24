/** @type {import('ts-jest').JestConfigWithTsJest} **/

module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        "^@services/(.*)$": "<rootDir>/src/services/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@config/(.*)$": "<rootDir>/src/config/$1",
        "^@consts/(.*)$": "<rootDir>/src/consts/$1",
        "^@database/(.*)$": "<rootDir>/src/database/$1",
        "^@errors/(.*)$": "<rootDir>/src/errors/$1",
        "^@config$": "<rootDir>/src/config",
        "^@services": "<rootDir>/src/services",
        "^node:(.*)$": "$1", // For Node.js built-in modules like 'node:fs'
    },
    coverageDirectory: "../coverage",
    moduleFileExtensions: ["js", "json", "ts"],
    testRegex: ".*\\.spec\\.ts$",
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    collectCoverageFrom: [
        "<rootDir>/src/config/*.ts",
        "<rootDir>/src/utils/helpers.ts",
    ],
};
