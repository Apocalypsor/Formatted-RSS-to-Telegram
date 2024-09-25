import {
    loadRSSFile,
    parseRSS,
    parseRSSFilter,
    parseRSSItem,
    parseRSSRule,
} from "@config/rss";
import {
    InvalidRSSFilterError,
    InvalidRSSItemError,
    InvalidRSSRuleError,
    LoadRSSFileError,
    RSSFileNotFoundError,
} from "@errors/config";
import { expandArrayInObject } from "@utils/helpers";
import fs from "fs";
import { parse } from "yaml";

jest.mock("fs");
jest.mock("yaml");
jest.mock("@utils/helpers");

describe("parseRSSRule", () => {
    test("should return RSSRule when input is valid", () => {
        const ruleInput = {
            obj: "title",
            type: "regex",
            matcher: ".*",
            dest: "newTitle",
        };
        const expectedOutput = {
            obj: "title",
            type: "regex",
            matcher: ".*",
            dest: "newTitle",
        };
        expect(parseRSSRule(ruleInput)).toEqual(expectedOutput);
    });

    test("should throw InvalidRSSRuleError when required properties are missing", () => {
        const ruleInput = {
            obj: "title",
            type: "regex",
            matcher: ".*",
        };
        expect(() => parseRSSRule(ruleInput)).toThrow(InvalidRSSRuleError);
    });

    test("should throw InvalidRSSRuleError when type is invalid", () => {
        const ruleInput = {
            obj: "title",
            type: "invalidType",
            matcher: ".*",
            dest: "newTitle",
        };
        expect(() => parseRSSRule(ruleInput)).toThrow(InvalidRSSRuleError);
    });
});

describe("parseRSSFilter", () => {
    test("should return RSSFilter when input is valid", () => {
        const filterInput = {
            obj: "title",
            type: "in",
            matcher: "keyword",
        };
        const expectedOutput = {
            obj: "title",
            type: "in",
            matcher: "keyword",
        };
        expect(parseRSSFilter(filterInput)).toEqual(expectedOutput);
    });

    test("should throw InvalidRSSFilterError when required properties are missing", () => {
        const filterInput = {
            obj: "title",
            matcher: "keyword",
        };
        expect(() => parseRSSFilter(filterInput)).toThrow(
            InvalidRSSFilterError,
        );
    });

    test("should throw InvalidRSSFilterError when type is invalid", () => {
        const filterInput = {
            obj: "title",
            type: "invalidType",
            matcher: "keyword",
        };
        expect(() => parseRSSFilter(filterInput)).toThrow(
            InvalidRSSFilterError,
        );
    });
});

describe("parseRSSItem", () => {
    test("should return RSS object when input is valid", () => {
        const rssItemInput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
            disableNotification: true,
            disableWebPagePreview: true,
            embedMedia: true,
            embedMediaExclude: ["https://example.com/.+"],
            fullText: true,
            rules: [
                {
                    obj: "title",
                    type: "regex",
                    matcher: ".*",
                    dest: "newTitle",
                },
            ],
            filters: [
                {
                    obj: "title",
                    type: "in",
                    matcher: "keyword",
                },
            ],
        };
        const expectedOutput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
            disableNotification: true,
            disableWebPagePreview: true,
            embedMedia: true,
            embedMediaExclude: ["https://example.com/.+"],
            fullText: true,
            rules: [
                {
                    obj: "title",
                    type: "regex",
                    matcher: ".*",
                    dest: "newTitle",
                },
            ],
            filters: [
                {
                    obj: "title",
                    type: "in",
                    matcher: "keyword",
                },
            ],
        };
        expect(parseRSSItem(rssItemInput)).toEqual(expectedOutput);
    });

    test("should throw InvalidRSSItemError when required properties are missing", () => {
        const rssItemInput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            // text is missing
        };
        expect(() => parseRSSItem(rssItemInput)).toThrow(InvalidRSSItemError);
    });

    test("should throw InvalidRSSItemError when embedMediaExclude is not an array", () => {
        const rssItemInput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
            embedMediaExclude: "https://example.com/.+",
        };
        expect(() => parseRSSItem(rssItemInput)).toThrow(InvalidRSSItemError);
    });

    test("should set default values for optional properties when they are missing", () => {
        const rssItemInput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
        };
        const expectedOutput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
            disableNotification: false,
            disableWebPagePreview: false,
            embedMedia: false,
            embedMediaExclude: [],
            fullText: false,
            rules: [],
            filters: [],
        };
        expect(parseRSSItem(rssItemInput)).toEqual(expectedOutput);
    });

    test("should parse rules and filters correctly", () => {
        const rssItemInput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
            rules: [
                {
                    obj: "title",
                    type: "regex",
                    matcher: ".*",
                    dest: "newTitle",
                },
            ],
            filters: [
                {
                    obj: "title",
                    type: "in",
                    matcher: "keyword",
                },
            ],
        };
        const expectedOutput = {
            name: "Feed Name",
            url: "https://example.com/rss",
            sendTo: "chatId1",
            text: "New article: {title}",
            disableNotification: false,
            disableWebPagePreview: false,
            embedMedia: false,
            embedMediaExclude: [],
            fullText: false,
            rules: [
                {
                    obj: "title",
                    type: "regex",
                    matcher: ".*",
                    dest: "newTitle",
                },
            ],
            filters: [
                {
                    obj: "title",
                    type: "in",
                    matcher: "keyword",
                },
            ],
        };
        expect(parseRSSItem(rssItemInput)).toEqual(expectedOutput);
    });
});

describe("parseRSS", () => {
    test("should return array of RSS objects when input is valid", () => {
        const rssInput = [
            {
                name: "Feed Name",
                url: "https://example.com/rss",
                sendTo: "chatId1",
                text: "New article: {title}",
            },
            {
                name: "Feed Name 2",
                url: ["https://example.com/rss1", "https://example.com/rss2"],
                sendTo: ["chatId1", "chatId2"],
                text: "New post: {title}",
            },
        ];

        const expandArrayInObjectMock = expandArrayInObject as jest.Mock;

        expandArrayInObjectMock.mockImplementation((obj, key) => {
            return obj[key].map((value: any) => ({ ...obj, [key]: value }));
        });

        const expectedOutput = [
            {
                name: "Feed Name",
                url: "https://example.com/rss",
                sendTo: "chatId1",
                text: "New article: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name 2",
                url: "https://example.com/rss1",
                sendTo: "chatId1",
                text: "New post: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name 2",
                url: "https://example.com/rss1",
                sendTo: "chatId2",
                text: "New post: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name 2",
                url: "https://example.com/rss2",
                sendTo: "chatId1",
                text: "New post: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name 2",
                url: "https://example.com/rss2",
                sendTo: "chatId2",
                text: "New post: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
        ];

        expect(parseRSS(rssInput)).toEqual(expectedOutput);
    });

    test("should throw InvalidRSSItemError when rss array is empty", () => {
        expect(() => parseRSS([])).toThrow(InvalidRSSItemError);
    });

    test("should throw InvalidRSSItemError when required properties are missing", () => {
        const rssInput = [
            {
                name: "Feed Name",
                url: "https://example.com/rss",
                // sendTo is missing
                // text is missing
            },
        ];
        expect(() => parseRSS(rssInput)).toThrow(InvalidRSSItemError);
    });

    test("should handle rssItem with array properties correctly", () => {
        const rssInput = [
            {
                name: "Feed Name",
                url: ["https://example.com/rss1", "https://example.com/rss2"],
                sendTo: ["chatId1", "chatId2"],
                text: "New article: {title}",
            },
        ];

        const expandArrayInObjectMock = expandArrayInObject as jest.Mock;

        expandArrayInObjectMock.mockImplementation((obj, key) => {
            return obj[key].map((value: any) => ({ ...obj, [key]: value }));
        });

        const expectedOutput = [
            {
                name: "Feed Name",
                url: "https://example.com/rss1",
                sendTo: "chatId1",
                text: "New article: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name",
                url: "https://example.com/rss1",
                sendTo: "chatId2",
                text: "New article: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name",
                url: "https://example.com/rss2",
                sendTo: "chatId1",
                text: "New article: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
            {
                name: "Feed Name",
                url: "https://example.com/rss2",
                sendTo: "chatId2",
                text: "New article: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
        ];

        expect(parseRSS(rssInput)).toEqual(expectedOutput);
    });
});

describe("loadRSSFile", () => {
    const mockFsExistsSync = fs.existsSync as jest.Mock;
    const mockFsReadFileSync = fs.readFileSync as jest.Mock;
    const mockYamlParse = parse as jest.Mock;
    const expandArrayInObjectMock = expandArrayInObject as jest.Mock;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("should return RSS array when loading a valid rss file", () => {
        const rssContent = `
            rss:
              - name: 'Feed Name'
                url: 'https://example.com/rss'
                sendTo: 'chatId1'
                text: 'New article: {title}'
        `;
        mockFsExistsSync.mockReturnValue(true);
        mockFsReadFileSync.mockReturnValue(rssContent);
        mockYamlParse.mockReturnValue({
            rss: [
                {
                    name: "Feed Name",
                    url: "https://example.com/rss",
                    sendTo: "chatId1",
                    text: "New article: {title}",
                },
            ],
        });

        const expectedOutput = [
            {
                name: "Feed Name",
                url: "https://example.com/rss",
                sendTo: "chatId1",
                text: "New article: {title}",
                disableNotification: false,
                disableWebPagePreview: false,
                embedMedia: false,
                embedMediaExclude: [],
                fullText: false,
                rules: [],
                filters: [],
            },
        ];

        const result = loadRSSFile(undefined);
        expect(result).toEqual(expectedOutput);
    });

    test("should throw RSSFileNotFoundError when rss file does not exist", () => {
        mockFsExistsSync.mockReturnValue(false);
        expect(() => loadRSSFile(undefined)).toThrow(RSSFileNotFoundError);
    });

    test("should throw LoadRSSFileError when rss content is invalid", () => {
        mockFsExistsSync.mockReturnValue(true);
        mockFsReadFileSync.mockReturnValue("invalid content");
        mockYamlParse.mockImplementation(() => {
            throw new Error("YAML parse error");
        });
        expect(() => loadRSSFile(undefined)).toThrow(LoadRSSFileError);
    });

    test("should throw LoadRSSFileError when parseRSS throws an error", () => {
        mockFsExistsSync.mockReturnValue(true);
        mockFsReadFileSync.mockReturnValue("content");
        mockYamlParse.mockReturnValue({});
        expect(() => loadRSSFile(undefined)).toThrow(LoadRSSFileError);
    });

    test("should use default rss file path when rssFile is undefined", () => {
        mockFsExistsSync.mockReturnValue(false);
        try {
            loadRSSFile(undefined);
        } catch (e) {}
        expect(mockFsExistsSync).toHaveBeenCalledWith("./config/rss.yaml");
    });

    test("should use provided rssFile path", () => {
        mockFsExistsSync.mockReturnValue(false);
        try {
            loadRSSFile("custom-rss.yaml");
        } catch (e) {}
        expect(mockFsExistsSync).toHaveBeenCalledWith(
            "./config/custom-rss.yaml",
        );
    });
});
