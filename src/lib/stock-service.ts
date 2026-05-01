import {
  MovementReason,
  MovementType,
  Prisma,
  RoleCode,
  StockKind,
  type StockMovement,
} from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { AppError, assertCondition } from "./errors";
import type { CurrentUser } from "./auth";

type Tx = Prisma.TransactionClient;

type CommonBooking = {
  articleId: string;
  quantity: number;
  barcodeValue?: string;
  note?: string;
  idempotencyKey?: string | null;
};

type StockInInput = CommonBooking & {
  warehouseId: string;
  unitCost?: string;
};

type StockOutInput = CommonBooking & {
  warehouseId: string;
  reason?: MovementReason;
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

async function ensureWarehouse(tx: Tx, warehouseId: string) {
  const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  assertCondition(warehouse, 404, "WAREHOUSE_NOT_FOUND", "Lager wurde nicht gefunden.");
  assertCondition(warehouse.active, 409, "WAREHOUSE_INACTIVE", "Lager ist deaktiviert.");
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

function ensureCanGoNegative(user: CurrentUser, allowNegativeStock: boolean) {
  if (!allowNegativeStock || user.role !== RoleCode.ADMIN) {
    throw new AppError(409, "INSUFFICIENT_STOCK", "Bestand reicht nicht aus.");
  }
}

export async function bookStockIn(input: StockInInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentMovement(tx, input.idempotencyKey);
    if (existing) return existing;

    await ensureArticle(tx, input.articleId);
    await ensureWarehouse(tx, input.warehouseId);
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

export async function bookStockOut(input: StockOutInput, user: CurrentUser) {
  return bookDecrease(input, user, MovementType.STOCK_OUT, StockKind.FULL);
}

export async function bookEmptyIn(input: StockInInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await findIdempotentMovement(tx, input.idempotencyKey);
    if (existing) return existing;

    const article = await ensureArticle(tx, input.articleId);
    assertCondition(article.supportsEmpties, 409, "EMPTIES_DISABLED", "Artikel unterstützt kein Leergut.");
    await ensureWarehouse(tx, input.warehouseId);
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
    await ensureWarehouse(tx, input.warehouseId);
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
        reason: input.reason ?? MovementReason.SONSTIGES,
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
    await ensureWarehouse(tx, input.fromWarehouseId);
    await ensureWarehouse(tx, input.toWarehouseId);
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
