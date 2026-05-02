-- Scanner package units and stock-in batches.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "ArticleUnit" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleUnit_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Barcode" ADD COLUMN "articleUnitId" TEXT;

-- CreateTable
CREATE TABLE "StockMovementBatch" (
    "id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL DEFAULT 'STOCK_IN',
    "stockKind" "StockKind" NOT NULL DEFAULT 'FULL',
    "warehouseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "itemCount" INTEGER NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovementBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "StockMovement"
ADD COLUMN "batchId" TEXT,
ADD COLUMN "articleUnitId" TEXT,
ADD COLUMN "unitLabel" TEXT,
ADD COLUMN "unitQuantity" INTEGER,
ADD COLUMN "unitCount" INTEGER;

-- Backfill one active base unit for existing articles.
INSERT INTO "ArticleUnit" (
    "id",
    "articleId",
    "label",
    "quantity",
    "sortOrder",
    "isDefault",
    "active",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "id",
    COALESCE(NULLIF("unit", ''), 'Stück'),
    1,
    0,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Article"
WHERE NOT EXISTS (
    SELECT 1 FROM "ArticleUnit" WHERE "ArticleUnit"."articleId" = "Article"."id"
);

-- Give existing beverage articles the scanner package presets.
UPDATE "ArticleUnit"
SET "label" = '1 Flasche'
FROM "Article"
JOIN "Category" ON "Category"."id" = "Article"."categoryId"
WHERE "ArticleUnit"."articleId" = "Article"."id"
  AND "ArticleUnit"."isDefault" = true
  AND ("Category"."slug" = 'getraenke' OR LOWER("Category"."name") = 'getränke');

INSERT INTO "ArticleUnit" (
    "id",
    "articleId",
    "label",
    "quantity",
    "sortOrder",
    "isDefault",
    "active",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "Article"."id",
    presets."label",
    presets."quantity",
    presets."sortOrder",
    false,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Article"
JOIN "Category" ON "Category"."id" = "Article"."categoryId"
CROSS JOIN (
    VALUES
        ('3 Stück', 3, 1),
        ('6 Stück', 6, 2),
        ('12 Stück', 12, 3),
        ('24 Stück / Kiste', 24, 4)
) AS presets("label", "quantity", "sortOrder")
WHERE "Category"."slug" = 'getraenke' OR LOWER("Category"."name") = 'getränke';

-- CreateIndex
CREATE INDEX "ArticleUnit_articleId_idx" ON "ArticleUnit"("articleId");
CREATE INDEX "ArticleUnit_active_idx" ON "ArticleUnit"("active");
CREATE INDEX "Barcode_articleUnitId_idx" ON "Barcode"("articleUnitId");
CREATE UNIQUE INDEX "StockMovementBatch_idempotencyKey_key" ON "StockMovementBatch"("idempotencyKey");
CREATE INDEX "StockMovementBatch_createdAt_idx" ON "StockMovementBatch"("createdAt");
CREATE INDEX "StockMovementBatch_warehouseId_idx" ON "StockMovementBatch"("warehouseId");
CREATE INDEX "StockMovementBatch_userId_idx" ON "StockMovementBatch"("userId");
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");
CREATE INDEX "StockMovement_articleUnitId_idx" ON "StockMovement"("articleUnitId");

-- AddForeignKey
ALTER TABLE "ArticleUnit" ADD CONSTRAINT "ArticleUnit_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_articleUnitId_fkey" FOREIGN KEY ("articleUnitId") REFERENCES "ArticleUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockMovementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_articleUnitId_fkey" FOREIGN KEY ("articleUnitId") REFERENCES "ArticleUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
