import { requireUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

const menuPermissions: Record<string, Parameters<typeof hasPermission>[1]> = {
  "artikel-neu": "article:write",
  einbuchen: "stock:book",
  ausbuchen: "stock:book",
  umbuchen: "stock:transfer",
  leergut: "stock:empty",
  bestand: "stock:read",
  buchungen: "movement:read",
};

export function GET() {
  return route(async () => {
    const user = await requireUser();
    const [labels, menuConfigs, settings] = await Promise.all([
      prisma.uiLabel.findMany({ where: { active: true } }),
      prisma.menuConfig.findMany({
        where: { visible: true, OR: [{ roleId: null }, { roleId: user.roleId }] },
        orderBy: [{ sortOrder: "asc" }],
      }),
      prisma.settings.findMany({ where: { key: { in: ["scanner", "deposit", "system"] } } }),
    ]);

    const labelMap = Object.fromEntries(labels.map((item) => [item.key, item.label]));
    const menuByKey = new Map<string, (typeof menuConfigs)[number]>();
    for (const item of menuConfigs) {
      const requiredPermission = menuPermissions[item.key];
      if (requiredPermission && !hasPermission(user, requiredPermission)) continue;
      menuByKey.set(item.key, item);
    }

    return ok({
      labels: labelMap,
      menu: Array.from(menuByKey.values()).sort((a, b) => a.sortOrder - b.sortOrder),
      settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
    });
  });
}
