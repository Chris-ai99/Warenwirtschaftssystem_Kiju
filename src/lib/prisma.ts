import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://kiju:kiju@localhost:5432/kiju_lager?schema=public";

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
