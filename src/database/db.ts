import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const checkHistoryInitialized = async (): Promise<boolean> => {
    const history = await prisma.history.findFirst();
    return !!history;
};

export const getFirstHistoryByURL = async (url: string) => {
    return prisma.history.findFirst({
        where: {
            url,
        },
    });
};

export const getHistory = async (
    uniqueHash: string,
    url: string,
    telegramChatId: bigint,
) => {
    return prisma.history.findFirst({
        where: {
            unique_hash: uniqueHash,
            url: url,
            telegram_chat_id: telegramChatId,
        },
    });
};

export const addHistory = async (
    uniqueHash: string,
    url: string,
    textHash: string,
    telegramName: string,
    telegramMessageId: bigint,
    telegramChatId: bigint,
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

export const updateHistory = async (
    id: number,
    textHash: string,
    telegramMessageId: bigint,
) => {
    return prisma.history.update({
        where: { id },
        data: {
            text_hash: textHash,
            telegram_message_id: telegramMessageId,
        },
    });
};

export const updateExpire = async (
    url: string,
    reset = false,
): Promise<number> => {
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

export const clean = async (numberOfDays = 30) => {
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

// Message Queue operations
export const enqueueMessage = async (
    taskType: string,
    taskData: string,
): Promise<number> => {
    const task = await prisma.messageQueue.create({
        data: {
            task_type: taskType,
            task_data: taskData,
            status: "pending",
        },
    });
    return task.id;
};

export const getPendingMessages = async () => {
    return prisma.messageQueue.findMany({
        where: {
            status: "pending",
        },
        orderBy: {
            created_at: "asc",
        },
    });
};

export const updateMessageStatus = async (
    id: number,
    status: string,
    error?: string,
) => {
    return prisma.messageQueue.update({
        where: { id },
        data: {
            status,
            error,
        },
    });
};

export const incrementRetryCount = async (id: number) => {
    return prisma.messageQueue.update({
        where: { id },
        data: {
            retry_count: { increment: 1 },
        },
    });
};

export const deleteCompletedMessages = async (olderThanHours = 24) => {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    await prisma.messageQueue.deleteMany({
        where: {
            status: "completed",
            updated_at: {
                lt: cutoffDate,
            },
        },
    });
};
