import { RoleCode } from "@/generated/prisma/client";
import { hashPassword, requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { userCreateSchema } from "@/lib/validation";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "user:write");
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return ok({
      users: users.map((item) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        active: item.active,
        role: item.role,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
  });
}

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "user:write");
    const input = await parseJson(request, userCreateSchema);
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: input.roleCode as RoleCode },
    });
    const created = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        active: input.active,
        roleId: role.id,
      },
      include: { role: true },
    });
    return ok(
      {
        user: {
          id: created.id,
          email: created.email,
          name: created.name,
          active: created.active,
          role: created.role,
        },
      },
      { status: 201 },
    );
  });
}
