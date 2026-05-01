import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { normalizeBarcode } from "@/lib/barcode";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";
import { barcodeSchema } from "@/lib/validation";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "article:write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const value = barcodeSchema.parse(body.value);

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new AppError(404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.");
    }

    const duplicate = await prisma.barcode.findUnique({ where: { value: normalizeBarcode(value) } });
    if (duplicate) {
      throw new AppError(409, "DUPLICATE_BARCODE", "Barcode ist bereits vergeben.");
    }

    const barcode = await prisma.barcode.create({
      data: {
        articleId: id,
        value: normalizeBarcode(value),
        primary: body.primary === true,
        type: body.type ?? "EAN",
      },
    });

    return ok({ barcode }, { status: 201 });
  });
}
