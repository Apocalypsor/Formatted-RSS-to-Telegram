// db.test.ts

import {
    addHistory,
    checkHistoryInitialized,
    clean,
    getFirstHistoryByURL,
    getHistory,
    prisma,
    updateExpire,
    updateHistory,
} from "@database/db";

jest.mock("@prisma/client", () => {
    const mPrismaClient = {
        history: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        expire: {
            upsert: jest.fn(),
        },
        $disconnect: jest.fn(),
    };
    return {
        PrismaClient: jest.fn(() => mPrismaClient),
    };
});

describe("db module", () => {
    let mockPrisma: any;

    beforeAll(() => {
        mockPrisma = prisma;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe("checkHistoryInitialized", () => {
        test("should return true when history exists", async () => {
            mockPrisma.history.findFirst.mockResolvedValue({ id: 1 });
            const result = await checkHistoryInitialized();
            expect(result).toBe(true);
            expect(mockPrisma.history.findFirst).toHaveBeenCalled();
        });

        test("should return false when history does not exist", async () => {
            mockPrisma.history.findFirst.mockResolvedValue(null);
            const result = await checkHistoryInitialized();
            expect(result).toBe(false);
            expect(mockPrisma.history.findFirst).toHaveBeenCalled();
        });
    });

    describe("getFirstHistoryByURL", () => {
        test("should return the first history entry matching the URL", async () => {
            const url = "https://example.com";
            const mockHistory = { id: 1, url };
            mockPrisma.history.findFirst.mockResolvedValue(mockHistory);
            const result = await getFirstHistoryByURL(url);
            expect(result).toEqual(mockHistory);
            expect(mockPrisma.history.findFirst).toHaveBeenCalledWith({
                where: { url },
            });
        });
    });

    describe("getHistory", () => {
        test("should return history entry matching uniqueHash, url, and telegramChatId", async () => {
            const uniqueHash = "hash123";
            const url = "https://example.com";
            const telegramChatId = BigInt(123456789);
            const mockHistory = {
                id: 1,
                unique_hash: uniqueHash,
                url,
                telegram_chat_id: telegramChatId,
            };
            mockPrisma.history.findFirst.mockResolvedValue(mockHistory);
            const result = await getHistory(uniqueHash, url, telegramChatId);
            expect(result).toEqual(mockHistory);
            expect(mockPrisma.history.findFirst).toHaveBeenCalledWith({
                where: {
                    unique_hash: uniqueHash,
                    url,
                    telegram_chat_id: telegramChatId,
                },
            });
        });
    });

    describe("addHistory", () => {
        test("should create a new history entry", async () => {
            const data = {
                uniqueHash: "hash123",
                url: "https://example.com",
                textHash: "textHash123",
                telegramName: "telegramBot",
                telegramMessageId: BigInt(123456789),
                telegramChatId: BigInt(987654321),
                telegraphUrl: "https://telegra.ph/example",
            };
            const mockHistory = { id: 1, ...data };
            mockPrisma.history.create.mockResolvedValue(mockHistory);
            const result = await addHistory(
                data.uniqueHash,
                data.url,
                data.textHash,
                data.telegramName,
                data.telegramMessageId,
                data.telegramChatId,
                data.telegraphUrl,
            );
            expect(result).toEqual(mockHistory);
            expect(mockPrisma.history.create).toHaveBeenCalledWith({
                data: {
                    unique_hash: data.uniqueHash,
                    url: data.url,
                    text_hash: data.textHash,
                    telegram_name: data.telegramName,
                    telegram_message_id: data.telegramMessageId,
                    telegram_chat_id: data.telegramChatId,
                    telegraph_url: data.telegraphUrl,
                },
            });
        });
    });

    describe("updateHistory", () => {
        test("should update an existing history entry", async () => {
            const id = 1;
            const textHash = "newTextHash";
            const telegramMessageId = BigInt(987654321);
            const mockHistory = {
                id,
                text_hash: textHash,
                telegram_message_id: telegramMessageId,
            };
            mockPrisma.history.update.mockResolvedValue(mockHistory);
            const result = await updateHistory(id, textHash, telegramMessageId);
            expect(result).toEqual(mockHistory);
            expect(mockPrisma.history.update).toHaveBeenCalledWith({
                where: { id },
                data: {
                    text_hash: textHash,
                    telegram_message_id: telegramMessageId,
                },
            });
        });
    });

    describe("updateExpire", () => {
        test("should increment expire when reset is false", async () => {
            const url = "https://example.com";
            const mockExpire = { url, expire: 2 };
            mockPrisma.expire.upsert.mockResolvedValue(mockExpire);
            const result = await updateExpire(url, false);
            expect(result).toBe(2);
            expect(mockPrisma.expire.upsert).toHaveBeenCalledWith({
                where: { url },
                update: {
                    expire: { increment: 1 },
                },
                create: {
                    url,
                    expire: 1,
                },
            });
        });

        test("should reset expire when reset is true", async () => {
            const url = "https://example.com";
            const mockExpire = { url, expire: 0 };
            mockPrisma.expire.upsert.mockResolvedValue(mockExpire);
            const result = await updateExpire(url, true);
            expect(result).toBe(0);
            expect(mockPrisma.expire.upsert).toHaveBeenCalledWith({
                where: { url },
                update: {
                    expire: 0,
                },
                create: {
                    url,
                    expire: 0,
                },
            });
        });

        test("should increment expire when reset is missed", async () => {
            const url = "https://example.com";
            const mockExpire = { url, expire: 0 };
            mockPrisma.expire.upsert.mockResolvedValue(mockExpire);
            const result = await updateExpire(url);
            expect(result).toBe(0);
            expect(mockPrisma.expire.upsert).toHaveBeenCalledWith({
                where: { url },
                update: {
                    expire: { increment: 1 },
                },
                create: {
                    url,
                    expire: 1,
                },
            });
        });
    });

    describe("clean", () => {
        test("should delete history entries older than specified number of days", async () => {
            const numberOfDays = 30;
            await clean(numberOfDays);

            expect(mockPrisma.history.deleteMany).toHaveBeenCalled();
        });

        test("should use default number of days when not specified", async () => {
            const defaultDays = 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - defaultDays);

            await clean();

            expect(mockPrisma.history.deleteMany).toHaveBeenCalledWith({
                where: {
                    created_at: {
                        lt: cutoffDate,
                    },
                },
            });
        });
    });
});
