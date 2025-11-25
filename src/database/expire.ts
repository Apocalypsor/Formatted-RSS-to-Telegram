import { prisma } from "./client";

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
