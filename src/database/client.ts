import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function initDatabase() {
    await prisma.$connect();
    await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL");
    await prisma.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
    await prisma.$executeRawUnsafe("PRAGMA cache_size = -20000");
    await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000");
    await prisma.$executeRawUnsafe("PRAGMA temp_store = MEMORY");
}
