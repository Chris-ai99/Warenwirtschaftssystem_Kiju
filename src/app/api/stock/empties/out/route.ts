import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { ok, parseJson, route } from "@/lib/route";
import { stockOutSchema } from "@/lib/validation";
import { bookEmptyOut } from "@/lib/stock-service";

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "stock:book");
    const input = await parseJson(request, stockOutSchema);
    const movement = await bookEmptyOut(
      { ...input, idempotencyKey: request.headers.get("idempotency-key") },
      user,
    );
    return ok({ movement }, { status: 201 });
  });
}
