import { getCurrentUser } from "@/lib/auth";
import { ok, route } from "@/lib/route";

export function GET() {
  return route(async () => {
    const user = await getCurrentUser();
    return ok({ user });
  });
}
