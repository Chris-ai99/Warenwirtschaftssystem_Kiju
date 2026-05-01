import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { settingsUpdateSchema } from "@/lib/validation";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");
    const settings = await prisma.settings.findMany();
    return ok({
      settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
    });
  });
}

export function PATCH(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "settings:write");
    const input = await parseJson(request, settingsUpdateSchema);

    const entries = Object.entries(input);
    for (const [key, value] of entries) {
      await prisma.settings.upsert({
        where: { key },
        update: { value, updatedById: user.id },
        create: { key, value, updatedById: user.id },
      });
    }

    return ok({ ok: true });
  });
}
