import { Prisma } from "@/generated/prisma/client";
import { normalizeBarcode } from "./barcode";
import { AppError } from "./errors";

type Tx = Prisma.TransactionClient;

export type ArticleUnitInput = {
  id?: string;
  label: string;
  quantity: number;
  sortOrder: number;
  isDefault: boolean;
  active: boolean;
  barcode?: string;
};

function normalizeUnitInputs(units: ArticleUnitInput[]) {
  let defaultAssigned = false;
  const activeUnits = units.filter((unit) => unit.active);

  return units.map((unit, index) => {
    const isDefault = unit.active && (unit.isDefault || (!defaultAssigned && activeUnits.length > 0));
    if (isDefault) defaultAssigned = true;
    return {
      ...unit,
      label: unit.label.trim(),
      sortOrder: unit.sortOrder ?? index,
      isDefault,
      barcode: unit.barcode ? normalizeBarcode(unit.barcode) : "",
    };
  });
}

export function collectArticleBarcodes(primaryBarcode?: string, units: ArticleUnitInput[] = []) {
  return [
    primaryBarcode ? normalizeBarcode(primaryBarcode) : "",
    ...units.map((unit) => (unit.barcode ? normalizeBarcode(unit.barcode) : "")),
  ].filter(Boolean);
}

export async function assertBarcodesAvailable(tx: Tx, values: string[], articleId?: string) {
  const uniqueValues = [...new Set(values)];
  if (uniqueValues.length !== values.length) {
    throw new AppError(409, "DUPLICATE_BARCODE", "Barcode ist mehrfach im Formular vorhanden.");
  }
  if (uniqueValues.length === 0) return;

  const duplicates = await tx.barcode.findMany({
    where: {
      value: { in: uniqueValues },
      ...(articleId ? { articleId: { not: articleId } } : {}),
    },
  });

  if (duplicates.length > 0) {
    throw new AppError(409, "DUPLICATE_BARCODE", "Barcode ist bereits vergeben.");
  }
}

export async function syncPrimaryBarcode(tx: Tx, articleId: string, barcode?: string) {
  if (!barcode) return;
  const value = normalizeBarcode(barcode);
  const existingPrimary = await tx.barcode.findFirst({
    where: { articleId, articleUnitId: null, primary: true },
  });

  if (existingPrimary) {
    await tx.barcode.update({
      where: { id: existingPrimary.id },
      data: { value, type: existingPrimary.type || "EAN", primary: true },
    });
    return;
  }

  await tx.barcode.create({
    data: { articleId, value, primary: true, type: "EAN" },
  });
}

export async function syncArticleUnits(tx: Tx, articleId: string, units: ArticleUnitInput[]) {
  const normalizedUnits = normalizeUnitInputs(units);
  const incomingIds = normalizedUnits.map((unit) => unit.id).filter(Boolean) as string[];

  if (incomingIds.length > 0) {
    const existingCount = await tx.articleUnit.count({
      where: { articleId, id: { in: incomingIds } },
    });
    if (existingCount !== incomingIds.length) {
      throw new AppError(404, "ARTICLE_UNIT_NOT_FOUND", "Gebindegröße wurde nicht gefunden.");
    }
  }

  await tx.articleUnit.updateMany({
    where: {
      articleId,
      ...(incomingIds.length > 0 ? { id: { notIn: incomingIds } } : {}),
    },
    data: { active: false, isDefault: false },
  });

  for (const unit of normalizedUnits) {
    const saved = unit.id
      ? await tx.articleUnit.update({
          where: { id: unit.id },
          data: {
            label: unit.label,
            quantity: unit.quantity,
            sortOrder: unit.sortOrder,
            isDefault: unit.isDefault,
            active: unit.active,
          },
        })
      : await tx.articleUnit.create({
          data: {
            articleId,
            label: unit.label,
            quantity: unit.quantity,
            sortOrder: unit.sortOrder,
            isDefault: unit.isDefault,
            active: unit.active,
          },
        });

    if (unit.barcode) {
      const existing = await tx.barcode.findFirst({
        where: { articleId, articleUnitId: saved.id },
      });
      if (existing) {
        await tx.barcode.update({
          where: { id: existing.id },
          data: { value: unit.barcode, primary: false, type: existing.type || "EAN" },
        });
      } else {
        await tx.barcode.create({
          data: {
            articleId,
            articleUnitId: saved.id,
            value: unit.barcode,
            primary: false,
            type: "EAN",
          },
        });
      }
    } else {
      await tx.barcode.deleteMany({ where: { articleId, articleUnitId: saved.id } });
    }
  }
}
