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
    },
    coverageDirectory: "../coverage",
    moduleFileExtensions: ["js", "json", "ts"],
    testRegex: ".*\\.spec\\.ts$",
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    collectCoverageFrom: ["**/*.(t|j)s"],
};
