// Single shared Prisma Client instance. Import this everywhere instead of
// creating `new PrismaClient()` in multiple files — each instance opens its
// own connection pool, and you don't want dozens of those.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
