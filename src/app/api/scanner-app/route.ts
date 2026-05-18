import { ok, route } from "@/lib/route";
import { scannerAppInfo } from "@/lib/scanner-app";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return route(async () => ok(await scannerAppInfo(request), { headers: { "Cache-Control": "no-store" } }));
}
