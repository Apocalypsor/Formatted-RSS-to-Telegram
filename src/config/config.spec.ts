// config.test.ts

import { UA } from "@consts/config";
import {
    ConfigFileNotFoundError,
    InvalidConfigError,
    InvalidTelegramConfigError,
    LoadConfigError,
} from "@errors/config";
import fs from "fs";
import { parse } from "yaml";
import {
    loadConfigFile,
    parseConfig,
    parseProxy,
    parseTelegram,
} from "./config";

jest.mock("fs");
jest.mock("yaml");

describe("parseProxy", () => {
    test("should return EnabledProxy when proxy is enabled with all required properties", () => {
        const proxyInput = {
            enabled: true,
            protocol: "https",
            host: "proxy.example.com",
            port: 8080,
            auth: {
                username: "user",
                password: "pass",
            },
        };
        const expectedOutput = {
            enabled: true,
            protocol: "https",
            host: "proxy.example.com",
            port: 8080,
            auth: {
                username: "user",
                password: "pass",
            },
        };
        expect(parseProxy(proxyInput)).toEqual(expectedOutput);
    });

    test("should return DisabledProxy when proxy is disabled", () => {
        const proxyInput = {
            enabled: false,
        };
        const expectedOutput = {
            enabled: false,
        };
        expect(parseProxy(proxyInput)).toEqual(expectedOutput);
    });

    test("should return DisabledProxy when proxy is undefined or empty", () => {
        expect(parseProxy(undefined)).toEqual({ enabled: false });
        expect(parseProxy({})).toEqual({ enabled: false });
    });

    test("should use default values for optional properties when they are missing", () => {
        const proxyInput = {
            enabled: true,
        };
        const expectedOutput = {
            enabled: true,
            protocol: "http",
            host: "127.0.0.1",
            port: 1080,
            auth: {
                username: "",
                password: "",
            },
        };
        expect(parseProxy(proxyInput)).toEqual(expectedOutput);
    });

    test("should use default values for optional properties(auth) when they are missing", () => {
        const proxyInput = {
            enabled: true,
            protocol: "http",
            host: "8.8.8.8",
            port: 3080,
        };
        const expectedOutput = {
            enabled: true,
            protocol: "http",
            host: "8.8.8.8",
            port: 3080,
            auth: {
                username: "",
                password: "",
            },
        };
        expect(parseProxy(proxyInput)).toEqual(expectedOutput);
    });
});

describe("parseTelegram", () => {
    test("should return array of Telegram objects when input is valid", () => {
        const telegramInput = [
            {
                name: "bot1",
                token: "token1",
                chatId: "chatId1",
                parseMode: "HTML",
                disableNotification: true,
                disableWebPagePreview: true,
            },
            {
                name: "bot2",
                token: "token2",
                chatId: "chatId2",
            },
        ];
        const expectedOutput = [
            {
                name: "bot1",
                token: "token1",
                chatId: "chatId1",
                parseMode: "HTML",
                disableNotification: true,
                disableWebPagePreview: true,
            },
            {
                name: "bot2",
                token: "token2",
                chatId: "chatId2",
                parseMode: "Markdown",
                disableNotification: false,
                disableWebPagePreview: false,
            },
        ];
        expect(parseTelegram(telegramInput)).toEqual(expectedOutput);
    });

    test("should throw InvalidTelegramConfigError when required properties are missing", () => {
        const telegramInput = [
            {
                name: "bot1",
                token: "token1",
            },
        ];
        expect(() => parseTelegram(telegramInput)).toThrow(
            InvalidTelegramConfigError,
        );
    });

    test("should throw InvalidTelegramConfigError when telegram is empty", () => {
        expect(() => parseTelegram([])).toThrow(InvalidTelegramConfigError);
    });

    test("should throw InvalidTelegramConfigError when telegram is invalid", () => {
        expect(() => parseTelegram(1234)).toThrow(InvalidTelegramConfigError);
    });

    test("should throw InvalidTelegramConfigError when telegram is undefined", () => {
        expect(() => parseTelegram(undefined)).toThrow(
            InvalidTelegramConfigError,
        );
    });

    test("should use default values for optional properties when they are missing", () => {
        const telegramInput = [
            {
                name: "bot1",
                token: "token1",
                chatId: "chatId1",
            },
        ];
        const expectedOutput = [
            {
                name: "bot1",
                token: "token1",
                chatId: "chatId1",
                parseMode: "Markdown",
                disableNotification: false,
                disableWebPagePreview: false,
            },
        ];
        expect(parseTelegram(telegramInput)).toEqual(expectedOutput);
    });
});

describe("parseConfig", () => {
    test("should return Config object when input is valid", () => {
        const configInput = {
            expireTime: 30,
            interval: 5,
            userAgent: "CustomUserAgent",
            notifyTelegramChatId: "123456789",
            flaresolverr: "http://flaresolverr.example.com/",
            proxy: {
                enabled: true,
                host: "proxy.example.com",
                port: 8080,
            },
            telegram: [
                {
                    name: "bot1",
                    token: "token1",
                    chatId: "chatId1",
                },
            ],
        };
        const expectedOutput = {
            expireTime: 30,
            interval: 5,
            userAgent: "CustomUserAgent",
            notifyTelegramChatId: "123456789",
            flaresolverr: "http://flaresolverr.example.com",
            proxy: {
                enabled: true,
                protocol: "http",
                host: "proxy.example.com",
                port: 8080,
                auth: {
                    username: "",
                    password: "",
                },
            },
            telegram: [
                {
                    name: "bot1",
                    token: "token1",
                    chatId: "chatId1",
                    parseMode: "Markdown",
                    disableNotification: false,
                    disableWebPagePreview: false,
                },
            ],
        };
        expect(parseConfig(configInput)).toEqual(expectedOutput);
    });

    test("should throw InvalidConfigError when config is undefined", () => {
        expect(() => parseConfig(undefined)).toThrow(InvalidConfigError);
    });

    test("should throw InvalidTelegramConfigError when telegram is invalid", () => {
        const configInput = {
            telegram: [],
        };
        expect(() => parseConfig(configInput)).toThrow(
            InvalidTelegramConfigError,
        );
    });

    test("should use default values for optional properties when they are missing", () => {
        const configInput = {
            telegram: [
                {
                    name: "bot1",
                    token: "token1",
                    chatId: "chatId1",
                },
            ],
        };
        const expectedOutput = {
            expireTime: 30,
            interval: 10,
            userAgent: UA,
            notifyTelegramChatId: undefined,
            flaresolverr: undefined,
            proxy: {
                enabled: false,
            },
            telegram: [
                {
                    name: "bot1",
                    token: "token1",
                    chatId: "chatId1",
                    parseMode: "Markdown",
                    disableNotification: false,
                    disableWebPagePreview: false,
                },
            ],
        };
        expect(parseConfig(configInput)).toEqual(expectedOutput);
    });
});

describe("loadConfigFile", () => {
    const mockFsExistsSync = fs.existsSync as jest.Mock;
    const mockFsReadFileSync = fs.readFileSync as jest.Mock;
    const mockYamlParse = parse as jest.Mock;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("should return Config object when loading a valid config file", () => {
        const configContent = `
            expireTime: 30
            interval: 5
            userAgent: 'CustomUserAgent'
            notifyTelegramChatId: '123456789'
            flaresolverr: 'http://flaresolverr.example.com/'
            proxy:
                enabled: true
                host: 'proxy.example.com'
                port: 8080
            telegram:
                - name: 'bot1'
                  token: 'token1'
                  chatId: 'chatId1'
        `;
        mockFsExistsSync.mockReturnValue(true);
        mockFsReadFileSync.mockReturnValue(configContent);
        mockYamlParse.mockReturnValue({
            expireTime: 30,
            interval: 5,
            userAgent: "CustomUserAgent",
            notifyTelegramChatId: "123456789",
            flaresolverr: "http://flaresolverr.example.com/",
            proxy: {
                enabled: true,
                host: "proxy.example.com",
                port: 8080,
            },
            telegram: [
                {
                    name: "bot1",
                    token: "token1",
                    chatId: "chatId1",
                },
            ],
        });

        const expectedConfig = {
            expireTime: 30,
            interval: 5,
            userAgent: "CustomUserAgent",
            notifyTelegramChatId: "123456789",
            flaresolverr: "http://flaresolverr.example.com",
            proxy: {
                enabled: true,
                protocol: "http",
                host: "proxy.example.com",
                port: 8080,
                auth: {
                    username: "",
                    password: "",
                },
            },
            telegram: [
                {
                    name: "bot1",
                    token: "token1",
                    chatId: "chatId1",
                    parseMode: "Markdown",
                    disableNotification: false,
                    disableWebPagePreview: false,
                },
            ],
        };

        const config = loadConfigFile(undefined);
        expect(config).toEqual(expectedConfig);
    });

    test("should throw ConfigFileNotFoundError when config file does not exist", () => {
        mockFsExistsSync.mockReturnValue(false);
        expect(() => loadConfigFile(undefined)).toThrow(
            ConfigFileNotFoundError,
        );
    });

    test("should throw LoadConfigError when config content is invalid", () => {
        mockFsExistsSync.mockReturnValue(true);
        mockFsReadFileSync.mockReturnValue("invalid content");
        mockYamlParse.mockImplementation(() => {
            throw new Error("YAML parse error");
        });
        expect(() => loadConfigFile(undefined)).toThrow(LoadConfigError);
    });

    test("should throw LoadConfigError when parseConfig throws an error", () => {
        mockFsExistsSync.mockReturnValue(true);
        mockFsReadFileSync.mockReturnValue("content");
        mockYamlParse.mockReturnValue({});
        expect(() => loadConfigFile(undefined)).toThrow(LoadConfigError);
    });

    test("should use default config file path when configFile is undefined", () => {
        mockFsExistsSync.mockReturnValue(false);
        try {
            loadConfigFile(undefined);
        } catch (e) {}
        expect(mockFsExistsSync).toHaveBeenCalledWith("./config/config.yaml");
    });

    test("should use provided configFile path", () => {
        mockFsExistsSync.mockReturnValue(false);
        try {
            loadConfigFile("custom-config.yaml");
        } catch (e) {}
        expect(mockFsExistsSync).toHaveBeenCalledWith(
            "./config/custom-config.yaml",
        );
    });
});
