import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import { normalizeBarcode } from "@/lib/barcode";
import { parseSimpleCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function get(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key]) return row[key];
  }
  return "";
}

export function POST(request: Request) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "import:write");

    const contentType = request.headers.get("content-type") ?? "";
    const csv = contentType.includes("application/json")
      ? (await request.json()).csv
      : await request.text();

    const { rows } = parseSimpleCsv(String(csv ?? ""));
    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const articleNumber = get(row, "Artikelnummer", "articleNumber").trim();
      const name = get(row, "Name", "Artikel", "name").trim();
      const barcodeValue = normalizeBarcode(get(row, "Barcode", "barcode").trim());
      const categoryName = get(row, "Kategorie", "category").trim();

      if (!articleNumber || !name) {
        errors.push({ row: rowNumber, message: "Artikelnummer und Name sind erforderlich." });
        continue;
      }

      const duplicateBarcode = barcodeValue
        ? await prisma.barcode.findUnique({
            where: { value: barcodeValue },
            include: { article: true },
          })
        : null;

      if (duplicateBarcode && duplicateBarcode.article.articleNumber !== articleNumber) {
        errors.push({ row: rowNumber, message: `Barcode ${barcodeValue} ist bereits vergeben.` });
        continue;
      }

      const category = categoryName
        ? await prisma.category.upsert({
            where: { slug: slugify(categoryName) },
            update: { name: categoryName, active: true },
            create: { name: categoryName, slug: slugify(categoryName) },
          })
        : null;

      const article = await prisma.article.upsert({
        where: { articleNumber },
        update: {
          name,
          categoryId: category?.id,
          purchasePrice: get(row, "Einkaufspreis", "purchasePrice") || undefined,
          salePrice: get(row, "Verkaufspreis", "salePrice") || undefined,
          depositAmount: get(row, "Pfandbetrag", "depositAmount") || undefined,
          unit: get(row, "Einheit", "unit") || undefined,
          supportsEmpties:
            get(row, "Leergut", "supportsEmpties").toLowerCase() === "ja" ||
            get(row, "Leergut", "supportsEmpties").toLowerCase() === "true",
        },
        create: {
          articleNumber,
          name,
          categoryId: category?.id,
          purchasePrice: get(row, "Einkaufspreis", "purchasePrice") || "0",
          salePrice: get(row, "Verkaufspreis", "salePrice") || "0",
          depositAmount: get(row, "Pfandbetrag", "depositAmount") || "0",
          unit: get(row, "Einheit", "unit") || "Stück",
          supportsEmpties:
            get(row, "Leergut", "supportsEmpties").toLowerCase() === "ja" ||
            get(row, "Leergut", "supportsEmpties").toLowerCase() === "true",
        },
      });

      if (barcodeValue && !duplicateBarcode) {
        await prisma.barcode.create({
          data: { articleId: article.id, value: barcodeValue, primary: true },
        });
      }

      imported += 1;
    }

    return ok({ imported, errors });
  });
}
