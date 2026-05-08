import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { categoryCreateSchema } from "@/lib/validation";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");
    const categories = await prisma.category.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return ok({ categories });
  });
}

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "category:write");
    const input = await parseJson(request, categoryCreateSchema);
    const category = await prisma.category.create({ data: input });
    return ok({ category }, { status: 201 });
  });
}
