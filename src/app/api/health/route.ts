import { prisma } from "@/lib/prisma";
import { route, ok } from "@/lib/route";

export function GET() {
  return route(async () => {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", time: new Date().toISOString() });
  });
}
