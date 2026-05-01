import { destroySession, requireUser, verifyCsrf } from "@/lib/auth";
import { ok, route } from "@/lib/route";

export function POST(request: Request) {
  return route(async () => {
    await requireUser();
    await verifyCsrf(request);
    await destroySession();
    return ok({ ok: true });
  });
}
