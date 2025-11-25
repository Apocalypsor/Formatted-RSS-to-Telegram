import { prisma } from "./client";

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
