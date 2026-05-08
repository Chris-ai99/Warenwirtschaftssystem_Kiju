import {
  MovementReason,
  MovementType,
  Prisma,
  StockKind,
  type StockMovement,
} from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { AppError, assertCondition } from "./errors";
import type { CurrentUser } from "./auth";
import { assertWarehouseAccess } from "./access-control";
import { hasPermission, permissionCatalog, type Permission } from "./permissions";

type Tx = Prisma.TransactionClient;

type CommonBooking = {
  articleId: string;
  quantity: number;
  barcodeValue?: string;
  reason?: string;
  note?: string;
  idempotencyKey?: string | null;
};

type StockInInput = CommonBooking & {
  warehouseId: string;
  unitCost?: string;
};

type StockInBatchInput = {
  warehouseId: string;
  reason?: string;
  note?: string;
  idempotencyKey?: string | null;
  items: {
    articleId: string;
    articleUnitId?: string | null;
    unitCount: number;
    barcodeValue?: string;
    note?: string;
  }[];
};

type StockOutInput = CommonBooking & {
  warehouseId: string;
};

type TransferInput = CommonBooking & {
  fromWarehouseId: string;
  toWarehouseId: string;
};

async function getAllowNegativeStock(tx: Tx) {
  const setting = await tx.settings.findUnique({ where: { key: "allowNegativeStock" } });
  return setting?.value === true;
}

async function ensureArticle(tx: Tx, articleId: string) {
  const article = await tx.article.findUnique({ where: { id: articleId } });
  assertCondition(article, 404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.");
  assertCondition(article.active, 409, "ARTICLE_INACTIVE", "Artikel ist deaktiviert.");
  return article;
}

async function ensureWarehouse(tx: Tx, warehouseId: string, user: CurrentUser) {
  const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  assertCondition(warehouse, 404, "WAREHOUSE_NOT_FOUND", "Lager wurde nicht gefunden.");
  assertCondition(warehouse.active, 409, "WAREHOUSE_INACTIVE", "Lager ist deaktiviert.");
  await assertWarehouseAccess(tx, user, warehouse);
  return warehouse;
}

async function upsertStock(tx: Tx, articleId: string, warehouseId: string) {
  return tx.stock.upsert({
    where: { articleId_warehouseId: { articleId, warehouseId } },
    update: {},
    create: { articleId, warehouseId },
  });
}

async function lockStockRows(tx: Tx, stockIds: string[]) {
  const sortedIds = [...new Set(stockIds)].sort();
  if (sortedIds.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM "Stock"
    WHERE id IN (${Prisma.join(sortedIds)})
    ORDER BY id
    FOR UPDATE
  `;
}

async function refetchStock(tx: Tx, stockId: string) {
  const stock = await tx.stock.findUnique({ where: { id: stockId } });
  assertCondition(stock, 404, "STOCK_NOT_FOUND", "Bestand wurde nicht gefunden.");
  return stock;
}

async function findIdempotentMovement(tx: Tx, idempotencyKey?: string | null) {
  if (!idempotencyKey) return null;
  return tx.stockMovement.findUnique({ where: { idempotencyKey } });
}

async function findIdempotentBatch(tx: Tx, idempotencyKey?: string | null) {
  if (!idempotencyKey) return null;
  return tx.stockMovementBatch.findUnique({
    where: { idempotencyKey },
    include: { movements: true },
  });
}

function ensureCanGoNegative(user: CurrentUser, allowNegativeStock: boolean) {
  if (!allowNegativeStock || !hasPermission(user, "stock:negative")) {
    throw new AppError(409, "INSUFFICIENT_STOCK", "Bestand reicht nicht aus.");
  }
}

const movementReasons = Object.values(MovementReason) as string[];
const permissionKeys = new Set(permissionCatalog.map((permission) => permission.key));

function isMovementReason(value: string): value is MovementReason {
  return movementReasons.includes(value);
}

function isPermission(value: string): value is Permission {
  return permissionKeys.has(value as Permission);
}

async function resolveBookingReason(
  tx: Tx,
  reasonCode: string | undefined,
  movementType: MovementType,
  stockKind: StockKind,
  note: string | undefined,
  user: CurrentUser,
) {
  const code = reasonCode?.trim();
  const bookingReason = code
    ? await tx.bookingReason.findFirst({
        where: { OR: [{ id: code }, { code }] },
      })
    : await tx.bookingReason.findFirst({
        where: {
          active: true,
          movementType,
          OR: [{ stockKind }, { stockKind: null }],
          isDefault: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

  if (!bookingReason) {
    if (code && isMovementReason(code)) {
      return { legacyReason: code, bookingReasonId: null };
    }
    if (code) {
      throw new AppError(400, "BOOKING_REASON_NOT_FOUND", "Buchungsgrund wurde nicht gefunden.");
    }
    return { legacyReason: MovementReason.SONSTIGES, bookingReasonId: null };
  }

  assertCondition(bookingReason.active, 409, "BOOKING_REASON_INACTIVE", "Buchungsgrund ist deaktiviert.");
  assertCondition(
    bookingReason.movementType === movementType,
    400,
    "BOOKING_REASON_TYPE_MISMATCH",
    "Buchungsgrund passt nicht zu dieser Buchungsart.",
  );
  assertCondition(
    !bookingReason.stockKind || bookingReason.stockKind === stockKind,
    400,
    "BOOKING_REASON_STOCK_KIND_MISMATCH",
    "Buchungsgrund passt nicht zu Vollgut/Leergut.",
  );
  assertCondition(
    !bookingReason.noteRequired || Boolean(note?.trim()),
    400,
    "BOOKING_REASON_NOTE_REQUIRED",
    "Für diesen Buchungsgrund ist eine Notiz erforderlich.",
  );

  if (bookingReason.permissionKey) {
    assertCondition(
      isPermission(bookingReason.permissionKey) && hasPermission(user, bookingReason.permissionKey),
      403,
      "BOOKING_REASON_PERMISSION_DENIED",
      "Für diesen Buchungsgrund fehlt dir die Berechtigung.",
    );
  }

  return {
    legacyReason: isMovementReason(bookingReason.code) ? bookingReason.code : MovementReason.SONSTIGES,
    bookingReasonId: bookingReason.id,
  };
}

export async function bookStockIn(input: StockInInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentMovement(tx, input.idempotencyKey);
    if (existing) return existing;

    await ensureArticle(tx, input.articleId);
    await ensureWarehouse(tx, input.warehouseId, user);
    const bookingReason = await resolveBookingReason(tx, input.reason, MovementType.STOCK_IN, StockKind.FULL, input.note, user);
    const stock = await upsertStock(tx, input.articleId, input.warehouseId);
    await lockStockRows(tx, [stock.id]);
    const current = await refetchStock(tx, stock.id);
    const nextFull = current.fullQuantity + input.quantity;

    await tx.stock.update({
      where: { id: current.id },
      data: { fullQuantity: nextFull },
    });

    return tx.stockMovement.create({
      data: {
        type: MovementType.STOCK_IN,
        stockKind: StockKind.FULL,
        articleId: input.articleId,
        barcodeValue: input.barcodeValue,
        quantity: input.quantity,
        toWarehouseId: input.warehouseId,
        bookingReasonId: bookingReason.bookingReasonId,
        note: input.note,
        unitCost: input.unitCost,
        userId: user.id,
        idempotencyKey: input.idempotencyKey ?? null,
        targetFullBefore: current.fullQuantity,
        targetFullAfter: nextFull,
        targetEmptyBefore: current.emptyQuantity,
        targetEmptyAfter: current.emptyQuantity,
      },
    });
  });
}

export async function bookStockInBatch(input: StockInBatchInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentBatch(tx, input.idempotencyKey);
    if (existing) return existing;

    assertCondition(input.items.length > 0, 400, "BATCH_EMPTY", "Die Scanliste ist leer.");
    await ensureWarehouse(tx, input.warehouseId, user);
    const bookingReason = await resolveBookingReason(tx, input.reason, MovementType.STOCK_IN, StockKind.FULL, input.note, user);

    const articleIds = [...new Set(input.items.map((item) => item.articleId))];
    const articles = await tx.article.findMany({
      where: { id: { in: articleIds } },
      include: { units: true },
    });
    const articleById = new Map(articles.map((article) => [article.id, article]));

    const resolvedItems = input.items.map((item) => {
      assertCondition(item.unitCount > 0, 400, "INVALID_QUANTITY", "Menge muss größer als 0 sein.");
      const article = articleById.get(item.articleId);
      assertCondition(article, 404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.", {
        articleId: item.articleId,
      });
      assertCondition(article.active, 409, "ARTICLE_INACTIVE", "Artikel ist deaktiviert.", {
        articleId: item.articleId,
      });

      const unit = item.articleUnitId
        ? article.units.find((candidate) => candidate.id === item.articleUnitId)
        : null;
      assertCondition(
        !item.articleUnitId || unit,
        404,
        "ARTICLE_UNIT_NOT_FOUND",
        "Gebindegröße wurde nicht gefunden.",
        { articleUnitId: item.articleUnitId },
      );
      assertCondition(
        !unit || unit.active,
        409,
        "ARTICLE_UNIT_INACTIVE",
        "Gebindegröße ist deaktiviert.",
        { articleUnitId: item.articleUnitId },
      );

      const unitQuantity = unit?.quantity ?? 1;
      const quantity = item.unitCount * unitQuantity;

      return {
        articleId: article.id,
        articleUnitId: unit?.id ?? null,
        barcodeValue: item.barcodeValue,
        note: item.note,
        unitCount: item.unitCount,
        unitLabel: unit?.label ?? article.unit,
        unitQuantity,
        quantity,
      };
    });

    const stocks = await Promise.all(
      articleIds.map((articleId) => upsertStock(tx, articleId, input.warehouseId)),
    );
    await lockStockRows(tx, stocks.map((stock) => stock.id));

    const currentByArticleId = new Map(
      await Promise.all(
        stocks.map(async (stock) => [stock.articleId, await refetchStock(tx, stock.id)] as const),
      ),
    );

    const batch = await tx.stockMovementBatch.create({
      data: {
        type: MovementType.STOCK_IN,
        stockKind: StockKind.FULL,
        warehouseId: input.warehouseId,
        userId: user.id,
        note: input.note,
        idempotencyKey: input.idempotencyKey ?? null,
        itemCount: resolvedItems.length,
        totalQuantity: resolvedItems.reduce((sum, item) => sum + item.quantity, 0),
      },
    });

    const movements = [];
    for (const item of resolvedItems) {
      const current = currentByArticleId.get(item.articleId);
      assertCondition(current, 404, "STOCK_NOT_FOUND", "Bestand wurde nicht gefunden.");
      const nextFull = current.fullQuantity + item.quantity;

      await tx.stock.update({
        where: { id: current.id },
        data: { fullQuantity: nextFull },
      });

      const movement = await tx.stockMovement.create({
        data: {
          type: MovementType.STOCK_IN,
          stockKind: StockKind.FULL,
          articleId: item.articleId,
          batchId: batch.id,
          articleUnitId: item.articleUnitId,
          barcodeValue: item.barcodeValue,
          quantity: item.quantity,
          unitLabel: item.unitLabel,
          unitQuantity: item.unitQuantity,
          unitCount: item.unitCount,
          toWarehouseId: input.warehouseId,
          bookingReasonId: bookingReason.bookingReasonId,
          note: item.note,
          userId: user.id,
          targetFullBefore: current.fullQuantity,
          targetFullAfter: nextFull,
          targetEmptyBefore: current.emptyQuantity,
          targetEmptyAfter: current.emptyQuantity,
        },
      });
      movements.push(movement);
      currentByArticleId.set(item.articleId, { ...current, fullQuantity: nextFull });
    }

    return { ...batch, movements };
  });
}

export async function bookStockOut(input: StockOutInput, user: CurrentUser) {
  return bookDecrease(input, user, MovementType.STOCK_OUT, StockKind.FULL);
}

export async function bookEmptyIn(input: StockInInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentMovement(tx, input.idempotencyKey);
    if (existing) return existing;

    const article = await ensureArticle(tx, input.articleId);
    assertCondition(article.supportsEmpties, 409, "EMPTIES_DISABLED", "Artikel unterstützt kein Leergut.");
    await ensureWarehouse(tx, input.warehouseId, user);
    const bookingReason = await resolveBookingReason(tx, input.reason, MovementType.EMPTY_IN, StockKind.EMPTY, input.note, user);
    const stock = await upsertStock(tx, input.articleId, input.warehouseId);
    await lockStockRows(tx, [stock.id]);
    const current = await refetchStock(tx, stock.id);
    const nextEmpty = current.emptyQuantity + input.quantity;

    await tx.stock.update({
      where: { id: current.id },
      data: { emptyQuantity: nextEmpty },
    });

    return tx.stockMovement.create({
      data: {
        type: MovementType.EMPTY_IN,
        stockKind: StockKind.EMPTY,
        articleId: input.articleId,
        barcodeValue: input.barcodeValue,
        quantity: input.quantity,
        toWarehouseId: input.warehouseId,
        bookingReasonId: bookingReason.bookingReasonId,
        note: input.note,
        unitCost: input.unitCost,
        userId: user.id,
        idempotencyKey: input.idempotencyKey ?? null,
        targetFullBefore: current.fullQuantity,
        targetFullAfter: current.fullQuantity,
        targetEmptyBefore: current.emptyQuantity,
        targetEmptyAfter: nextEmpty,
      },
    });
  });
}

export async function bookEmptyOut(input: StockOutInput, user: CurrentUser) {
  return bookDecrease(input, user, MovementType.EMPTY_OUT, StockKind.EMPTY);
}

async function bookDecrease(
  input: StockOutInput,
  user: CurrentUser,
  type: MovementType,
  stockKind: StockKind,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentMovement(tx, input.idempotencyKey);
    if (existing) return existing;

    const article = await ensureArticle(tx, input.articleId);
    if (stockKind === StockKind.EMPTY) {
      assertCondition(article.supportsEmpties, 409, "EMPTIES_DISABLED", "Artikel unterstützt kein Leergut.");
    }
    await ensureWarehouse(tx, input.warehouseId, user);
    const bookingReason = await resolveBookingReason(tx, input.reason, type, stockKind, input.note, user);
    const allowNegativeStock = await getAllowNegativeStock(tx);
    const stock = await upsertStock(tx, input.articleId, input.warehouseId);
    await lockStockRows(tx, [stock.id]);
    const current = await refetchStock(tx, stock.id);
    const currentQuantity =
      stockKind === StockKind.FULL ? current.fullQuantity : current.emptyQuantity;
    const nextQuantity = currentQuantity - input.quantity;

    if (nextQuantity < 0) {
      ensureCanGoNegative(user, allowNegativeStock);
    }

    await tx.stock.update({
      where: { id: current.id },
      data:
        stockKind === StockKind.FULL
          ? { fullQuantity: nextQuantity }
          : { emptyQuantity: nextQuantity },
    });

    return tx.stockMovement.create({
      data: {
        type,
        stockKind,
        articleId: input.articleId,
        barcodeValue: input.barcodeValue,
        quantity: input.quantity,
        fromWarehouseId: input.warehouseId,
        reason: bookingReason.legacyReason,
        bookingReasonId: bookingReason.bookingReasonId,
        note: input.note,
        userId: user.id,
        idempotencyKey: input.idempotencyKey ?? null,
        sourceFullBefore: current.fullQuantity,
        sourceFullAfter: stockKind === StockKind.FULL ? nextQuantity : current.fullQuantity,
        sourceEmptyBefore: current.emptyQuantity,
        sourceEmptyAfter: stockKind === StockKind.EMPTY ? nextQuantity : current.emptyQuantity,
      },
    });
  });
}

export async function transferStock(input: TransferInput, user: CurrentUser) {
  assertCondition(
    input.fromWarehouseId !== input.toWarehouseId,
    400,
    "TRANSFER_SAME_WAREHOUSE",
    "Quell- und Ziellager müssen unterschiedlich sein.",
  );

  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentMovement(tx, input.idempotencyKey);
    if (existing) return existing;

    await ensureArticle(tx, input.articleId);
    await ensureWarehouse(tx, input.fromWarehouseId, user);
    await ensureWarehouse(tx, input.toWarehouseId, user);
    const bookingReason = await resolveBookingReason(tx, input.reason, MovementType.TRANSFER, StockKind.FULL, input.note, user);
    const allowNegativeStock = await getAllowNegativeStock(tx);

    const source = await upsertStock(tx, input.articleId, input.fromWarehouseId);
    const target = await upsertStock(tx, input.articleId, input.toWarehouseId);
    await lockStockRows(tx, [source.id, target.id]);

    const currentSource = await refetchStock(tx, source.id);
    const currentTarget = await refetchStock(tx, target.id);
    const nextSourceFull = currentSource.fullQuantity - input.quantity;
    const nextTargetFull = currentTarget.fullQuantity + input.quantity;

    if (nextSourceFull < 0) {
      ensureCanGoNegative(user, allowNegativeStock);
    }

    await tx.stock.update({
      where: { id: currentSource.id },
      data: { fullQuantity: nextSourceFull },
    });
    await tx.stock.update({
      where: { id: currentTarget.id },
      data: { fullQuantity: nextTargetFull },
    });

    return tx.stockMovement.create({
      data: {
        type: MovementType.TRANSFER,
        stockKind: StockKind.FULL,
        articleId: input.articleId,
        barcodeValue: input.barcodeValue,
        quantity: input.quantity,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        bookingReasonId: bookingReason.bookingReasonId,
        note: input.note,
        userId: user.id,
        idempotencyKey: input.idempotencyKey ?? null,
        sourceFullBefore: currentSource.fullQuantity,
        sourceFullAfter: nextSourceFull,
        sourceEmptyBefore: currentSource.emptyQuantity,
        sourceEmptyAfter: currentSource.emptyQuantity,
        targetFullBefore: currentTarget.fullQuantity,
        targetFullAfter: nextTargetFull,
        targetEmptyBefore: currentTarget.emptyQuantity,
        targetEmptyAfter: currentTarget.emptyQuantity,
      },
    });
  });
}

export function movementDepositValue(movement: Pick<StockMovement, "quantity">, depositAmount: Prisma.Decimal) {
  return depositAmount.mul(movement.quantity);
}
