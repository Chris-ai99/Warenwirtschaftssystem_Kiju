import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { ok, parseJson, route } from "@/lib/route";
import { stockInSchema } from "@/lib/validation";
import { bookEmptyIn } from "@/lib/stock-service";

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "stock:empty");
    const input = await parseJson(request, stockInSchema);
    const movement = await bookEmptyIn(
      { ...input, idempotencyKey: request.headers.get("idempotency-key") },
      user,
    );
    return ok({ movement }, { status: 201 });
  });
}
