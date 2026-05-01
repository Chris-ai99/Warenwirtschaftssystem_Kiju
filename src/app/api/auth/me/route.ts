import { getCurrentUser } from "@/lib/auth";
import { ok, route } from "@/lib/route";
import { permissionsForRole } from "@/lib/permissions";

export function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    return ok({
      user: user
        ? {
            ...user,
            permissions: permissionsForRole(user.role),
          }
        : null,
    });
  });
}
