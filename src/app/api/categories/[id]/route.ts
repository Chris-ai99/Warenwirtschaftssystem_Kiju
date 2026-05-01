import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { categoryUpdateSchema } from "@/lib/validation";

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "article:write");
    const { id } = await context.params;
    const input = await parseJson(request, categoryUpdateSchema);
    const category = await prisma.category.update({ where: { id }, data: input });
    return ok({ category });
  });
}
