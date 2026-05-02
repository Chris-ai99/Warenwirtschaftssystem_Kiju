import { z } from "zod";
import { MovementReason, WarehouseType } from "@/generated/prisma/client";
import { normalizeBarcode } from "./barcode";

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).replace(",", "."))
  .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "Bitte einen gültigen Betrag eingeben."));

export const barcodeSchema = z
  .string()
  .transform(normalizeBarcode)
  .pipe(z.string().min(3).max(64));

const articleUnitInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().positive().max(10000),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  barcode: barcodeSchema.optional().or(z.literal("")),
});

export const articleCreateSchema = z.object({
  barcode: barcodeSchema.optional(),
  articleNumber: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  categoryId: z.string().uuid().nullable().optional(),
  categoryName: z.string().trim().max(120).optional(),
  purchasePrice: decimalString.default("0"),
  salePrice: decimalString.default("0"),
  depositAmount: decimalString.default("0"),
  unit: z.string().trim().min(1).max(40).default("Stück"),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  active: z.boolean().default(true),
  supportsEmpties: z.boolean().default(false),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  units: z.array(articleUnitInputSchema).max(20).default([]),
});

export const articleUpdateSchema = articleCreateSchema.partial().extend({
  barcode: barcodeSchema.optional(),
});

export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40).toUpperCase(),
  type: z.enum(WarehouseType).default(WarehouseType.MAIN),
  active: z.boolean().default(true),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((value) => value.toLowerCase()),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const stockInSchema = z.object({
  articleId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  barcodeValue: barcodeSchema.optional(),
  unitCost: decimalString.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const stockInBatchSchema = z.object({
  warehouseId: z.string().uuid(),
  note: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        articleId: z.string().uuid(),
        articleUnitId: z.string().uuid().nullable().optional(),
        unitCount: z.coerce.number().int().positive().max(100000),
        barcodeValue: barcodeSchema.optional(),
        note: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const stockOutSchema = z.object({
  articleId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  barcodeValue: barcodeSchema.optional(),
  reason: z.enum(MovementReason).default(MovementReason.SONSTIGES),
  note: z.string().trim().max(1000).optional(),
});

export const stockTransferSchema = z.object({
  articleId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  barcodeValue: barcodeSchema.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

export const userCreateSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8),
  roleCode: z.enum(["ADMIN", "MITARBEITER"]).default("MITARBEITER"),
  active: z.boolean().default(true),
});

export const userUpdateSchema = userCreateSchema
  .omit({ password: true })
  .partial()
  .extend({ password: z.string().min(8).optional() });

export const settingsUpdateSchema = z.object({
  allowNegativeStock: z.boolean().optional(),
  lowStockThresholdDefault: z.coerce.number().int().min(0).optional(),
});
