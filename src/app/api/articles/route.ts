import { MovementType, StockKind } from "@/generated/prisma/client";
import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import {
  assertBarcodesAvailable,
  collectArticleBarcodes,
  syncArticleUnits,
  syncPrimaryBarcode,
} from "@/lib/article-units";
import { normalizeBarcode } from "@/lib/barcode";
import { assertCondition } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { articleCreateSchema } from "@/lib/validation";
import { hasPermission } from "@/lib/permissions";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const barcode = url.searchParams.get("barcode")?.trim();
    const categoryId = url.searchParams.get("categoryId") ?? undefined;
    const activeParam = url.searchParams.get("active");
    const active = activeParam === null ? undefined : activeParam === "true";

    if (barcode) {
      const value = normalizeBarcode(barcode);
      const match = await prisma.barcode.findUnique({
        where: { value },
        include: {
          article: {
            include: {
              category: true,
              barcodes: true,
              stocks: true,
              units: { include: { barcodes: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      });
      return ok({ articles: match ? [match.article] : [] });
    }

    const articles = await prisma.article.findMany({
      where: {
        active,
        categoryId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { articleNumber: { contains: search, mode: "insensitive" } },
                { barcodes: { some: { value: { contains: normalizeBarcode(search) } } } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        barcodes: true,
        units: { include: { barcodes: true }, orderBy: { sortOrder: "asc" } },
        stocks: { include: { warehouse: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    return ok({ articles });
  });
}

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "article:write");

    const input = await parseJson(request, articleCreateSchema);
    const barcodeValue = input.barcode ? normalizeBarcode(input.barcode) : undefined;
    const articleNumber = input.articleNumber || barcodeValue;
    assertCondition(articleNumber, 400, "ARTICLE_NUMBER_REQUIRED", "Artikelnummer oder Barcode ist erforderlich.");

    const article = await prisma.$transaction(async (tx) => {
      await assertBarcodesAvailable(tx, collectArticleBarcodes(barcodeValue, input.units));

      const canWritePrices = hasPermission(user, "price:write");
      let categoryId = input.categoryId ?? null;
      if (!categoryId && input.categoryName) {
        const category = await tx.category.upsert({
          where: { slug: slugify(input.categoryName) },
          update: { name: input.categoryName, active: true },
          create: { name: input.categoryName, slug: slugify(input.categoryName) },
        });
        categoryId = category.id;
      }

      const created = await tx.article.create({
        data: {
          articleNumber,
          name: input.name,
          categoryId,
          purchasePrice: canWritePrices ? input.purchasePrice : "0",
          salePrice: canWritePrices ? input.salePrice : "0",
          depositAmount: canWritePrices ? input.depositAmount : "0",
          unit: input.unit,
          description: input.description,
          imageUrl: input.imageUrl || null,
          active: input.active,
          supportsEmpties: input.supportsEmpties,
          lowStockThreshold: input.lowStockThreshold,
        },
      });

      await syncPrimaryBarcode(tx, created.id, barcodeValue);
      await syncArticleUnits(tx, created.id, input.units);

      await tx.stockMovement.create({
        data: {
          type: MovementType.ARTICLE_CREATED,
          stockKind: StockKind.FULL,
          articleId: created.id,
          barcodeValue,
          quantity: 0,
          userId: user.id,
          note: "Artikel angelegt",
        },
      });

      return tx.article.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          category: true,
          barcodes: true,
          units: { include: { barcodes: true }, orderBy: { sortOrder: "asc" } },
          stocks: true,
        },
      });
    });

    return ok({ article }, { status: 201 });
  });
}
