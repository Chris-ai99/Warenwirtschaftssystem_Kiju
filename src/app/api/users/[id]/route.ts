import { hashPassword, requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { userUpdateSchema } from "@/lib/validation";

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "user:write");
    const { id } = await context.params;
    const input = await parseJson(request, userUpdateSchema);
    const role = input.roleCode
      ? await prisma.role.findUniqueOrThrow({ where: { code: input.roleCode } })
      : null;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        email: input.email,
        name: input.name,
        active: input.active,
        roleId: role?.id,
        passwordHash: input.password ? await hashPassword(input.password) : undefined,
      },
      include: { role: true },
    });
    return ok({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        active: updated.active,
        role: updated.role,
      },
    });
  });
}
