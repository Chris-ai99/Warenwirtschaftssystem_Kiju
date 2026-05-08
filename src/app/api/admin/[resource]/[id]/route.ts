import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import {
  deleteAdminResource,
  normalizeAdminResource,
  permissionForAdminResource,
  updateAdminResource,
} from "@/lib/admin-resources";
import { ok, route } from "@/lib/route";

async function readBody(request: Request) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    const { resource, id } = await context.params;
    requirePermission(user, "admin:access");
    requirePermission(user, permissionForAdminResource(resource, "write"));
    const item = await updateAdminResource(normalizeAdminResource(resource), id, await readBody(request), user);
    return ok({ item });
  });
}

export function DELETE(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    const { resource, id } = await context.params;
    requirePermission(user, "admin:access");
    requirePermission(user, permissionForAdminResource(resource, "delete"));
    const item = await deleteAdminResource(normalizeAdminResource(resource), id, user);
    return ok({ item });
  });
}
