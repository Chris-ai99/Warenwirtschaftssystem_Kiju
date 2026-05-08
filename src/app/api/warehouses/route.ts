import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { warehouseAccessWhere } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { warehouseCreateSchema } from "@/lib/validation";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "warehouse:read");
    const where = await warehouseAccessWhere(prisma, user);
    const warehouses = await prisma.warehouse.findMany({
      where,
      include: { stocks: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return ok({ warehouses });
  });
}

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "warehouse:write");
    const input = await parseJson(request, warehouseCreateSchema);
    const warehouse = await prisma.warehouse.create({ data: input });
    return ok({ warehouse }, { status: 201 });
  });
}
