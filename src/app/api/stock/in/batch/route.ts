import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { ok, parseJson, route } from "@/lib/route";
import { bookStockInBatch } from "@/lib/stock-service";
import { stockInBatchSchema } from "@/lib/validation";

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "stock:book");
    const input = await parseJson(request, stockInBatchSchema);
    const batch = await bookStockInBatch(
      { ...input, idempotencyKey: request.headers.get("idempotency-key") },
      user,
    );
    return ok({ batch }, { status: 201 });
  });
}
