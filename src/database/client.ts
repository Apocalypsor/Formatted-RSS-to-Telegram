import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function initDatabase() {
    await prisma.$connect();
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
    await prisma.$queryRawUnsafe("PRAGMA cache_size = -20000");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
    await prisma.$queryRawUnsafe("PRAGMA temp_store = MEMORY");
}
