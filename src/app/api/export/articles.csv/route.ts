import { requirePermission, requireUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/route";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "export:read");
    const articles = await prisma.article.findMany({
      include: { category: true, barcodes: true },
      orderBy: { name: "asc" },
    });

    const csv = toCsv(
      [
        "Artikelnummer",
        "Name",
        "Kategorie",
        "Barcodes",
        "Einkaufspreis",
        "Verkaufspreis",
        "Pfandbetrag",
        "Einheit",
        "Aktiv",
        "Leergut",
      ],
      articles.map((article) => [
        article.articleNumber,
        article.name,
        article.category?.name ?? "",
        article.barcodes.map((barcode) => barcode.value).join(", "),
        article.purchasePrice.toFixed(2),
        article.salePrice.toFixed(2),
        article.depositAmount.toFixed(2),
        article.unit,
        article.active ? "ja" : "nein",
        article.supportsEmpties ? "ja" : "nein",
      ]),
    );

    return csvResponse("artikel.csv", csv);
  });
}
