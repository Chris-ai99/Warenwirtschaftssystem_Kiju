import { requirePermission, requireUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/route";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "export:read");
    const stocks = await prisma.stock.findMany({
      include: { article: { include: { barcodes: true } }, warehouse: true },
      orderBy: [{ article: { name: "asc" } }, { warehouse: { name: "asc" } }],
    });

    const csv = toCsv(
      [
        "Artikelnummer",
        "Artikel",
        "Barcode",
        "Lager",
        "Vollgut",
        "Leergut",
        "Verfügbar",
        "Pfandwert",
      ],
      stocks.map((stock) => [
        stock.article.articleNumber,
        stock.article.name,
        stock.article.barcodes.find((barcode) => barcode.primary)?.value ??
          stock.article.barcodes[0]?.value ??
          "",
        stock.warehouse.name,
        stock.fullQuantity,
        stock.emptyQuantity,
        stock.fullQuantity - stock.reservedQuantity,
        stock.article.depositAmount.mul(stock.emptyQuantity).toFixed(2),
      ]),
    );

    return csvResponse("bestand.csv", csv);
  });
}
