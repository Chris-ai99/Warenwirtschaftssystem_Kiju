import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { ok, parseJson, route } from "@/lib/route";
import { stockTransferSchema } from "@/lib/validation";
import { transferStock } from "@/lib/stock-service";

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "stock:transfer");
    const input = await parseJson(request, stockTransferSchema);
    const movement = await transferStock(
      { ...input, idempotencyKey: request.headers.get("idempotency-key") },
      user,
    );
    return ok({ movement }, { status: 201 });
  });
}
