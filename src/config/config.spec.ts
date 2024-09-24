// import {
//     loadConfigFile,
//     parseConfig,
//     parseProxy,
//     parseTelegram,
// } from "@config/config";
// import {
//     ConfigFileNotFoundError,
//     InvalidConfigError,
//     InvalidConfigProxyError,
//     InvalidTelegramConfigError,
//     LoadConfigError,
// } from "@errors/config";
// import fs from "fs";
// import { parse } from "yaml";
//
// jest.mock("fs");
// jest.mock("yaml");
//
// describe("parseProxy", () => {
//     test("should return disabled proxy when proxy is undefined", () => {
//         const result = parseProxy(undefined);
//         expect(result).toEqual({ enabled: false });
//     });
//
//     test("should return disabled proxy when proxy.enabled is false", () => {
//         const result = parseProxy({ enabled: false });
//         expect(result).toEqual({ enabled: false });
//     });
//
//     test("should return enabled proxy with defaults when proxy.enabled is true", () => {
//         const proxyInput = {
//             enabled: true,
//             host: "proxyhost",
//             port: 8080,
//         };
//         const result = parseProxy(proxyInput);
//         expect(result).toEqual({
//             enabled: true,
//             protocol: "http",
//             host: "proxyhost",
//             port: 8080,
//             auth: {
//                 username: "",
//                 password: "",
//             },
//         });
//     });
//
//     test("should throw InvalidConfigProxyError when enabled proxy missing host", () => {
//         const proxyInput = {
//             enabled: true,
//             port: 8080,
//         };
//         expect(() => parseProxy(proxyInput)).toThrow(InvalidConfigProxyError);
//     });
//
//     test("should throw InvalidConfigProxyError when enabled proxy missing port", () => {
//         const proxyInput = {
//             enabled: true,
//             host: "proxyhost",
//         };
//         expect(() => parseProxy(proxyInput)).toThrow(InvalidConfigProxyError);
//     });
//
//     test("should parse proxy with optional fields", () => {
//         const proxyInput = {
//             enabled: true,
//             protocol: "https",
//             host: "proxyhost",
//             port: 8080,
//             auth: {
//                 username: "user",
//                 password: "pass",
//             },
//         };
//         const result = parseProxy(proxyInput);
//         expect(result).toEqual({
//             enabled: true,
//             protocol: "https",
//             host: "proxyhost",
//             port: 8080,
//             auth: {
//                 username: "user",
//                 password: "pass",
//             },
//         });
//     });
// });
// ``;
// describe("parseTelegram", () => {
//     test("should throw InvalidTelegramConfigError when telegram is undefined", () => {
//         expect(() => parseTelegram(undefined)).toThrow(
//             InvalidTelegramConfigError,
//         );
//     });
//
//     test("should throw InvalidTelegramConfigError when telegram is empty array", () => {
//         expect(() => parseTelegram([])).toThrow(InvalidTelegramConfigError);
//     });
//
//     test("should parse valid telegram configurations", () => {
//         const telegramInput = [
//             {
//                 name: "Bot1",
//                 token: "token1",
//                 chatId: "chat1",
//             },
//             {
//                 name: "Bot2",
//                 token: "token2",
//                 chatId: "chat2",
//                 parseMode: "HTML",
//                 disableNotification: true,
//                 disableWebPagePreview: true,
//             },
//         ];
//         const result = parseTelegram(telegramInput);
//         expect(result).toEqual([
//             {
//                 name: "Bot1",
//                 token: "token1",
//                 chatId: "chat1",
//                 parseMode: "Markdown",
//                 disableNotification: false,
//                 disableWebPagePreview: false,
//             },
//             {
//                 name: "Bot2",
//                 token: "token2",
//                 chatId: "chat2",
//                 parseMode: "HTML",
//                 disableNotification: true,
//                 disableWebPagePreview: true,
//             },
//         ]);
//     });
//
//     test("should throw InvalidTelegramConfigError when telegram config missing name", () => {
//         const telegramInput = [
//             {
//                 token: "token1",
//                 chatId: "chat1",
//             },
//         ];
//         expect(() => parseTelegram(telegramInput)).toThrow(
//             InvalidTelegramConfigError,
//         );
//     });
//
//     test("should throw InvalidTelegramConfigError when telegram config missing token", () => {
//         const telegramInput = [
//             {
//                 name: "Bot1",
//                 chatId: "chat1",
//             },
//         ];
//         expect(() => parseTelegram(telegramInput)).toThrow(
//             InvalidTelegramConfigError,
//         );
//     });
//
//     test("should throw InvalidTelegramConfigError when telegram config missing chatId", () => {
//         const telegramInput = [
//             {
//                 name: "Bot1",
//                 token: "token1",
//             },
//         ];
//         expect(() => parseTelegram(telegramInput)).toThrow(
//             InvalidTelegramConfigError,
//         );
//     });
// });
//
// describe("parseConfig", () => {
//     test("should throw InvalidConfigError when config is undefined", () => {
//         expect(() => parseConfig(undefined)).toThrow(InvalidConfigError);
//     });
//
//     test("should parse valid config with defaults", () => {
//         const configInput = {
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                 },
//             ],
//         };
//         const result = parseConfig(configInput);
//         expect(result).toEqual({
//             expireTime: 365,
//             interval: 10,
//             userAgent: expect.any(String), // UA constant from @consts/config
//             notifyTelegramChatId: undefined,
//             flaresolverr: undefined,
//             proxy: { enabled: false },
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                     parseMode: "Markdown",
//                     disableNotification: false,
//                     disableWebPagePreview: false,
//                 },
//             ],
//         });
//     });
//
//     test("should parse valid config with provided values", () => {
//         const configInput = {
//             expireTime: 30,
//             interval: 5,
//             userAgent: "CustomUserAgent",
//             notifyTelegramChatId: "notifyChatId",
//             flaresolverr: "http://localhost:8191/",
//             proxy: {
//                 enabled: true,
//                 host: "proxyhost",
//                 port: 8080,
//             },
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                 },
//             ],
//         };
//         const result = parseConfig(configInput);
//         expect(result).toEqual({
//             expireTime: 30,
//             interval: 5,
//             userAgent: "CustomUserAgent",
//             notifyTelegramChatId: "notifyTelegramChatId",
//             flaresolverr: "http://localhost:8191", // trailing slash removed
//             proxy: {
//                 enabled: true,
//                 protocol: "http",
//                 host: "proxyhost",
//                 port: 8080,
//                 auth: {
//                     username: "",
//                     password: "",
//                 },
//             },
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                     parseMode: "Markdown",
//                     disableNotification: false,
//                     disableWebPagePreview: false,
//                 },
//             ],
//         });
//     });
//
//     test("should propagate errors from parseProxy", () => {
//         const configInput = {
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                 },
//             ],
//             proxy: {
//                 enabled: true,
//                 port: 8080,
//             },
//         };
//         expect(() => parseConfig(configInput)).toThrow(InvalidConfigProxyError);
//     });
//
//     test("should propagate errors from parseTelegram", () => {
//         const configInput = {
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                 },
//             ],
//         };
//         expect(() => parseConfig(configInput)).toThrow(
//             InvalidTelegramConfigError,
//         );
//     });
// });
//
// describe("loadConfigFile", () => {
//     const mockFsExistsSync = fs.existsSync as jest.MockedFunction<
//         typeof fs.existsSync
//     >;
//     const mockFsReadFileSync = fs.readFileSync as jest.MockedFunction<
//         typeof fs.readFileSync
//     >;
//     const mockYamlParse = parse as jest.MockedFunction<typeof parse>;
//
//     beforeEach(() => {
//         jest.resetAllMocks();
//     });
//
//     test("should throw ConfigFileNotFoundError when file does not exist", () => {
//         mockFsExistsSync.mockReturnValue(false);
//         expect(() => loadConfigFile(undefined)).toThrow(
//             ConfigFileNotFoundError,
//         );
//     });
//
//     test("should throw LoadConfigError when parseConfig throws error", () => {
//         mockFsExistsSync.mockReturnValue(true);
//         mockFsReadFileSync.mockReturnValue("file contents");
//         mockYamlParse.mockReturnValue({}); // returns empty config
//         expect(() => loadConfigFile(undefined)).toThrow(LoadConfigError);
//     });
//
//     test("should load and parse config file successfully", () => {
//         const configContent = `
// expireTime: 30
// interval: 5
// userAgent: CustomUserAgent
// notifyTelegramChatId: notifyChatId
// flaresolverr: http://localhost:8191/
// proxy:
//   enabled: true
//   host: proxyhost
//   port: 8080
// telegram:
//   - name: Bot1
//     token: token1
//     chatId: chat1
// `;
//         const parsedYaml = {
//             expireTime: 30,
//             interval: 5,
//             userAgent: "CustomUserAgent",
//             notifyTelegramChatId: "notifyChatId",
//             flaresolverr: "http://localhost:8191/",
//             proxy: {
//                 enabled: true,
//                 host: "proxyhost",
//                 port: 8080,
//             },
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                 },
//             ],
//         };
//
//         mockFsExistsSync.mockReturnValue(true);
//         mockFsReadFileSync.mockReturnValue(configContent);
//         mockYamlParse.mockReturnValue(parsedYaml);
//
//         const result = loadConfigFile(undefined);
//
//         expect(result).toEqual({
//             expireTime: 30,
//             interval: 5,
//             userAgent: "CustomUserAgent",
//             notifyTelegramChatId: "notifyChatId",
//             flaresolverr: "http://localhost:8191",
//             proxy: {
//                 enabled: true,
//                 protocol: "http",
//                 host: "proxyhost",
//                 port: 8080,
//                 auth: {
//                     username: "",
//                     password: "",
//                 },
//             },
//             telegram: [
//                 {
//                     name: "Bot1",
//                     token: "token1",
//                     chatId: "chat1",
//                     parseMode: "Markdown",
//                     disableNotification: false,
//                     disableWebPagePreview: false,
//                 },
//             ],
//         });
//     });
// });
