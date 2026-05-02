import { requirePermission, requireUser } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { route } from "@/lib/route";

export function GET() {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "export:read");
    const movements = await prisma.stockMovement.findMany({
      include: { article: true, user: true, fromWarehouse: true, toWarehouse: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const csv = toCsv(
      [
        "Datum",
        "Benutzer",
        "Artikelnummer",
        "Artikel",
        "Barcode",
        "Typ",
        "Menge",
        "Gebinde",
        "Gebinde Anzahl",
        "Gebinde Faktor",
        "Bestandsart",
        "Von Lager",
        "Nach Lager",
        "Grund",
        "Notiz",
        "Quelle vorher",
        "Quelle nachher",
        "Ziel vorher",
        "Ziel nachher",
      ],
      movements.map((movement) => [
        movement.createdAt.toISOString(),
        movement.user.name,
        movement.article.articleNumber,
        movement.article.name,
        movement.barcodeValue ?? "",
        movement.type,
        movement.quantity,
        movement.unitLabel ?? "",
        movement.unitCount ?? "",
        movement.unitQuantity ?? "",
        movement.stockKind,
        movement.fromWarehouse?.name ?? "",
        movement.toWarehouse?.name ?? "",
        movement.reason ?? "",
        movement.note ?? "",
        movement.sourceFullBefore ?? movement.sourceEmptyBefore ?? "",
        movement.sourceFullAfter ?? movement.sourceEmptyAfter ?? "",
        movement.targetFullBefore ?? movement.targetEmptyBefore ?? "",
        movement.targetFullAfter ?? movement.targetEmptyAfter ?? "",
      ]),
    );

    return csvResponse("buchungsverlauf.csv", csv);
  });
}
