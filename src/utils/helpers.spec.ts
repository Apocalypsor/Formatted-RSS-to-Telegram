import {
    createDirIfNotExists,
    expandArrayInObject,
    extractMediaUrls,
    getObj,
    hash,
    htmlDecode,
    isIntranet,
    mapError,
    parseIPFromURL,
} from "@utils/helpers";
import dns from "dns";
import fs from "fs";
import { JSDOM } from "jsdom";

jest.mock("fs", () => {
    const actualFs = jest.requireActual("fs");
    return {
        ...actualFs,
        existsSync: jest.fn(),
        promises: {
            ...actualFs.promises,
            mkdir: jest.fn(),
        },
    };
});

jest.mock("dns");
jest.mock("jsdom");

describe("hash", () => {
    test("should return correct SHA-256 hash for a given string", () => {
        const input = "Hello, World!";
        const expectedHash =
            "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f";
        expect(hash(input)).toBe(expectedHash);
    });

    test("should return correct hash for an empty string", () => {
        const input = "";
        const expectedHash =
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        expect(hash(input)).toBe(expectedHash);
    });
});

describe("expandArrayInObject", () => {
    test("should expand array in object correctly", () => {
        const obj = { id: 1, values: [10, 20, 30] };
        const key = "values";
        const expected = [
            { id: 1, values: 10 },
            { id: 1, values: 20 },
            { id: 1, values: 30 },
        ];
        expect(expandArrayInObject(obj, key)).toEqual(expected);
    });

    test("should handle empty array", () => {
        const obj = { id: 1, values: [] };
        const key = "values";
        expect(expandArrayInObject(obj, key)).toEqual([]);
    });

    test("should handle non-array values", () => {
        const obj = { id: 1, values: "not an array" };
        const key = "values";
        expect(expandArrayInObject(obj, key)).toEqual([obj]);
    });
});

describe("getObj", () => {
    const testObj = {
        a: {
            b: [{ c: 1 }, { c: 2 }, { c: 3 }],
        },
        x: {
            y: {
                z: "found me",
            },
        },
        numKeysObject: {
            0: "zero",
            1: "one",
            2: "two",
            42: "answer",
        },
        mixedKeysObject: {
            foo: "bar",
            42: "string forty-two",
        },
        arr: [1, 2, 3],
    };

    test("should retrieve value from object with numeric string keys", () => {
        expect(getObj(testObj, "numKeysObject.0")).toBe("zero");
        expect(getObj(testObj, "numKeysObject.1")).toBe("one");
        expect(getObj(testObj, "numKeysObject.42")).toBe("answer");
    });

    test("should retrieve value from object with numeric keys using parsed integers", () => {
        expect(getObj(testObj, "mixedKeysObject.42")).toBe("string forty-two");
    });

    test("should return undefined when numeric key does not exist", () => {
        expect(getObj(testObj, "numKeysObject.99")).toBeUndefined();
    });

    test("should return undefined when path segment cannot be parsed to integer", () => {
        expect(getObj(testObj, "numKeysObject.foo")).toBeUndefined();
    });

    test("should handle negative indices and return undefined", () => {
        expect(getObj(testObj, "a.b.-1")).toBeUndefined();
    });

    test("should return undefined when accessing property of a non-object/non-array", () => {
        expect(getObj(testObj, "a.b.0.c.d")).toBeUndefined();
    });

    test("should return undefined early when accessing property of undefined", () => {
        expect(getObj(testObj, "a.b.0.c.d.e")).toBeUndefined();
    });

    test("should retrieve value from array", () => {
        expect(getObj(testObj, "arr.0")).toBe(1);
        expect(getObj(testObj, "arr.1")).toBe(2);
        expect(getObj(testObj, "arr.2")).toBe(3);
    });

    test("should return undefined when array index is out of bounds", () => {
        expect(getObj(testObj, "arr.3")).toBeUndefined();
    });

    test("should return undefined when accessing property of a number", () => {
        expect(getObj(testObj, "arr.0.c")).toBeUndefined();
    });
});

describe("createDirIfNotExists", () => {
    const mockFsExistsSync = fs.existsSync as jest.MockedFunction<
        typeof fs.existsSync
    >;
    const mockFsMkdir = fs.promises.mkdir as jest.MockedFunction<
        typeof fs.promises.mkdir
    >;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should create directory if it does not exist", async () => {
        mockFsExistsSync.mockReturnValue(false);
        mockFsMkdir.mockResolvedValue(undefined);

        await createDirIfNotExists("/path/to/dir");

        expect(mockFsExistsSync).toHaveBeenCalledWith("/path/to/dir");
        expect(mockFsMkdir).toHaveBeenCalledWith("/path/to/dir", {
            recursive: true,
        });
    });

    test("should not create directory if it already exists", async () => {
        mockFsExistsSync.mockReturnValue(true);

        await createDirIfNotExists("/path/to/dir");

        expect(mockFsExistsSync).toHaveBeenCalledWith("/path/to/dir");
        expect(mockFsMkdir).not.toHaveBeenCalled();
    });
});

describe("parseIPFromURL", () => {
    const mockDnsLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should return IP address for valid URL", async () => {
        mockDnsLookup.mockImplementation((hostname, callback) => {
            callback(null, "127.0.0.1", 4);
        });

        const ip = await parseIPFromURL("http://localhost");
        expect(mockDnsLookup).toHaveBeenCalledWith(
            "localhost",
            expect.any(Function),
        );
        expect(ip).toBe("127.0.0.1");
    });

    test("should throw error for invalid URL", async () => {
        await expect(parseIPFromURL("invalid-url")).rejects.toThrow();
    });

    test("should handle dns.lookup errors", async () => {
        mockDnsLookup.mockImplementation((hostname, callback) => {
            callback(new Error("DNS Error"), "", 4);
        });

        await expect(parseIPFromURL("http://example.com")).rejects.toThrow(
            "DNS Error",
        );
    });
});

describe("isIntranet", () => {
    test("should return true for 10.x.x.x IPs", () => {
        expect(isIntranet("10.0.0.1")).toBe(true);
    });

    test("should return true for 172.16.x.x to 172.31.x.x IPs", () => {
        expect(isIntranet("172.16.0.1")).toBe(true);
        expect(isIntranet("172.31.255.255")).toBe(true);
        expect(isIntranet("172.15.255.255")).toBe(false);
        expect(isIntranet("172.32.0.0")).toBe(false);
    });

    test("should return true for 192.168.x.x IPs", () => {
        expect(isIntranet("192.168.1.1")).toBe(true);
    });

    test("should return false for public IPs", () => {
        expect(isIntranet("8.8.8.8")).toBe(false);
        expect(isIntranet("1.1.1.1")).toBe(false);
    });

    test("should handle invalid IP addresses", () => {
        expect(isIntranet("999.999.999.999")).toBe(false);
        expect(isIntranet("not.an.ip")).toBe(false);
    });
});

describe("htmlDecode", () => {
    const mockJSDOM = JSDOM as jest.MockedClass<typeof JSDOM>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should extract <rss>...</rss> content", () => {
        const input =
            "<html><body>&lt;rss&gt;RSS Content&lt;/rss&gt;</body></html>";
        const mockWindow = {
            document: { body: { textContent: "<rss>RSS Content</rss>" } },
        };
        mockJSDOM.mockImplementation(
            () => ({ window: mockWindow }) as unknown as JSDOM,
        );

        expect(htmlDecode(input)).toBe("<rss>RSS Content</rss>");
    });

    test("should extract <feed>...</feed> content", () => {
        const input =
            "<html><body>&lt;feed&gt;Feed Content&lt;/feed&gt;</body></html>";
        const mockWindow = {
            document: { body: { textContent: "<feed>Feed Content</feed>" } },
        };
        mockJSDOM.mockImplementation(
            () => ({ window: mockWindow }) as unknown as JSDOM,
        );

        expect(htmlDecode(input)).toBe("<feed>Feed Content</feed>");
    });

    test("should return null if no matching content", () => {
        const input = "<html><body>No relevant content here.</body></html>";
        const mockWindow = {
            document: { body: { textContent: "No relevant content here." } },
        };
        mockJSDOM.mockImplementation(
            () => ({ window: mockWindow }) as unknown as JSDOM,
        );

        expect(htmlDecode(input)).toBeNull();
    });

    test("should return null for empty body content", () => {
        const input = "<html><body></body></html>";
        const mockWindow = { document: { body: { textContent: "" } } };
        mockJSDOM.mockImplementation(
            () => ({ window: mockWindow }) as unknown as JSDOM,
        );

        expect(htmlDecode(input)).toBeNull();
    });
});

describe("mapError", () => {
    test("should return message from Error instance", () => {
        const error = new Error("Something went wrong");
        expect(mapError(error)).toBe("Something went wrong");
    });

    test("should stringify non-Error objects", () => {
        const error = { code: 500, message: "Internal Server Error" };
        expect(mapError(error)).toBe(JSON.stringify(error));
    });

    test("should handle string errors", () => {
        const error = "An error occurred";
        expect(mapError(error)).toBe('"An error occurred"');
    });

    test("should handle null or undefined errors", () => {
        expect(mapError(null)).toBe("null");
        expect(mapError(undefined)).toBe(undefined);
    });
});

describe("extractMediaUrls", () => {
    test("should extract image URLs with double quotes", () => {
        const htmlContent = `<img src="http://example.com/image1.jpg" alt="Image 1">`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image1.jpg",
            },
        ]);
    });

    test("should extract image URLs with single quotes", () => {
        const htmlContent = `<img src='http://example.com/image2.png' alt='Image 2'>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image2.png",
            },
        ]);
    });

    test("should extract multiple image URLs", () => {
        const htmlContent = `
      <img src="http://example.com/image1.jpg" alt="Image 1">
      <img src='http://example.com/image2.png' alt='Image 2'>
      <img src="http://example.com/image3.gif" alt="Image 3">
    `;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image1.jpg",
            },
            {
                type: "photo",
                url: "http://example.com/image2.png",
            },
            {
                type: "photo",
                url: "http://example.com/image3.gif",
            },
        ]);
    });

    test("should handle attributes in different order", () => {
        const htmlContent = `<img alt="Image 4" src="http://example.com/image4.jpg">`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image4.jpg",
            },
        ]);
    });

    test("should handle self-closing img tags", () => {
        const htmlContent = `<img src="http://example.com/image5.jpg" alt="Image 5"/>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image5.jpg",
            },
        ]);
    });

    test("should return empty array when no images are present", () => {
        const htmlContent = `<p>No images here</p>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should ignore img tags without src attribute", () => {
        const htmlContent = `<img alt="No source">`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should handle img tags with unquoted src attribute", () => {
        const htmlContent = `<img src=http://example.com/image6.jpg alt=Image6>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should not extract URLs from commented out img tags", () => {
        const htmlContent = `
            <!-- <img src="http://example.com/image7.jpg" alt="Commented Image"> -->
            <img src="http://example.com/test.jpg" alt="Commented Image">
        `;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/test.jpg",
            },
        ]);
    });

    test("should handle img tags with extra whitespace", () => {
        const htmlContent = `<img    src =    "http://example.com/image8.jpg"    alt =    "Image 8"   >`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image8.jpg",
            },
        ]);
    });

    test("should extract video URLs from video tags", () => {
        const htmlContent = `<video src="http://example.com/video1.mp4" controls></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video1.mp4",
            },
        ]);
    });

    test("should extract video URLs from source tags", () => {
        const htmlContent = `<source src='http://example.com/video2.webm' type='video/webm'>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video2.webm",
            },
        ]);
    });

    test("should extract multiple video URLs", () => {
        const htmlContent = `
      <video src="http://example.com/video1.mp4" controls></video>
      <source src='http://example.com/video2.webm' type='video/webm'>
      <video controls>
        <source src="http://example.com/video3.mp4" type="video/mp4">
      </video>
    `;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video1.mp4",
            },
            {
                type: "video",
                url: "http://example.com/video2.webm",
            },
            {
                type: "video",
                url: "http://example.com/video3.mp4",
            },
        ]);
    });

    test("should handle attributes in different order", () => {
        const htmlContent = `<video controls src="http://example.com/video4.mp4"></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video4.mp4",
            },
        ]);
    });

    test("should handle self-closing source tags", () => {
        const htmlContent = `<source src="http://example.com/video5.mp4" type="video/mp4" />`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video5.mp4",
            },
        ]);
    });

    test("should return empty array when no videos are present", () => {
        const htmlContent = `<p>No videos here</p>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should ignore video/source tags without src attribute", () => {
        const htmlContent = `<video controls></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should handle video tags with unquoted src attribute", () => {
        const htmlContent = `<video src=http://example.com/video6.mp4 controls></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should not extract URLs from commented out video tags", () => {
        const htmlContent = `<!-- <video src="http://example.com/video7.mp4" controls></video> -->`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([]);
    });

    test("should handle video/source tags with extra whitespace", () => {
        const htmlContent = `<video    src =    "http://example.com/video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video8.mp4",
            },
        ]);
    });

    test("should retain sequence of media URLs", () => {
        const htmlContent = `
            <img src="http://example.com/image1.jpg" alt="Image 1">
            <video src="http://example.com/video1.mp4" controls></video>
            <img src='http://example.com/image2.png' alt='Image 2'>
            <source src='http://example.com/video2.webm' type='video/webm'>
        `;

        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "photo",
                url: "http://example.com/image1.jpg",
            },
            {
                type: "video",
                url: "http://example.com/video1.mp4",
            },
            {
                type: "photo",
                url: "http://example.com/image2.png",
            },
            {
                type: "video",
                url: "http://example.com/video2.webm",
            },
        ]);
    });

    test("should handle src starts with ./", () => {
        const htmlContent = `<video    src="./video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "/video8.mp4",
            },
        ]);
    });

    test("should handle src starts with ./", () => {
        const htmlContent = `<video    src="./video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent, "http://example.com");
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video8.mp4",
            },
        ]);
    });

    test("should handle src starts with ./", () => {
        const htmlContent = `<video    src="./video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent, "http://example.com/test");
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/test/video8.mp4",
            },
        ]);
    });

    test("should handle src starts with ./", () => {
        const htmlContent = `<video    src="./video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(
            htmlContent,
            "http://example.com/test/",
        );
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/test/video8.mp4",
            },
        ]);
    });

    test("should handle src ./", () => {
        const htmlContent = `<video    src="./"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "/",
            },
        ]);
    });

    test("should handle src starts with /", () => {
        const htmlContent = `<video    src="/video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "/video8.mp4",
            },
        ]);
    });

    test("should handle src starts with /", () => {
        const htmlContent = `<video    src="/video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent, "http://example.com");
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video8.mp4",
            },
        ]);
    });

    test("should handle src starts with /", () => {
        const htmlContent = `<video    src="/video8.mp4"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent, "http://example.com/test");
        expect(result).toEqual([
            {
                type: "video",
                url: "http://example.com/video8.mp4",
            },
        ]);
    });

    test("should handle src /", () => {
        const htmlContent = `<video    src="/"    controls   ></video>`;
        const result = extractMediaUrls(htmlContent);
        expect(result).toEqual([
            {
                type: "video",
                url: "/",
            },
        ]);
    });
});
