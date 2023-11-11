import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getFirstHistoryByURL = async (url: string) => {
    return prisma.history.findFirst({
        where: {
            url,
        },
    });
};

const getHistory = async (
    uniqueHash: string,
    url: string,
    telegramChatId: number,
) => {
    return prisma.history.findFirst({
        where: {
            unique_hash: uniqueHash,
            url: url,
            telegram_chat_id: telegramChatId,
        },
    });
};

const addHistory = async (
    uniqueHash: string,
    url: string,
    textHash: string,
    telegramName: string,
    telegramMessageId: number,
    telegramChatId: number,
    telegraphUrl: string | null,
) => {
    return prisma.history.create({
        data: {
            unique_hash: uniqueHash,
            url: url,
            text_hash: textHash,
            telegram_name: telegramName,
            telegram_message_id: telegramMessageId,
            telegram_chat_id: telegramChatId,
            telegraph_url: telegraphUrl,
        },
    });
};

const updateHistory = async (
    id: number,
    textHash: string,
    telegramMessageId: number,
) => {
    return prisma.history.update({
        where: { id },
        data: {
            text_hash: textHash,
            telegram_message_id: telegramMessageId,
        },
    });
};

const updateExpire = async (url: string, reset = false) => {
    const expireEntry = await prisma.expire.upsert({
        where: { url },
        update: {
            expire: reset ? 0 : { increment: 1 },
        },
        create: {
            url,
            expire: reset ? 0 : 1,
        },
    });

    return expireEntry.expire;
};

const clean = async (numberOfDays = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - numberOfDays);

    await prisma.history.deleteMany({
        where: {
            created_at: {
                lt: cutoffDate,
            },
        },
    });
};

export {
    getFirstHistoryByURL,
    getHistory,
    addHistory,
    updateHistory,
    updateExpire,
    clean,
};
