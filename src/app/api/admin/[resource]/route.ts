import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import {
  createAdminResource,
  listAdminResource,
  normalizeAdminResource,
  permissionForAdminResource,
} from "@/lib/admin-resources";
import { ok, route } from "@/lib/route";

async function readBody(request: Request) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  return route(async () => {
    const user = await requireUser();
    const { resource } = await context.params;
    requirePermission(user, "admin:access");
    requirePermission(user, permissionForAdminResource(resource, "read"));
    const data = await listAdminResource(normalizeAdminResource(resource), request.url);
    return ok(data);
  });
}

export function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    const { resource } = await context.params;
    requirePermission(user, "admin:access");
    requirePermission(user, permissionForAdminResource(resource, "write"));
    const created = await createAdminResource(normalizeAdminResource(resource), await readBody(request), user);
    return ok({ item: created }, { status: 201 });
  });
}
