-- Reconcile the existing scanner batch schema and add the flexible admin system.

DO $$ BEGIN
  ALTER TYPE "WarehouseType" ADD VALUE 'OTHER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Role" ALTER COLUMN "code" TYPE TEXT USING "code"::text;
DROP TYPE IF EXISTS "RoleCode";

ALTER TABLE "Role"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "system" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "color" TEXT,
  ADD COLUMN IF NOT EXISTS "defaultDepositAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "defaultUnit" TEXT,
  ADD COLUMN IF NOT EXISTS "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emptiesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "icon" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Warehouse"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "locationId" TEXT,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "visibleToEmployees" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "group" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserWarehouseAccess" (
  "userId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserWarehouseAccess_pkey" PRIMARY KEY ("userId", "warehouseId")
);

CREATE TABLE IF NOT EXISTS "UserLocationAccess" (
  "userId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserLocationAccess_pkey" PRIMARY KEY ("userId", "locationId")
);

CREATE TABLE IF NOT EXISTS "PackagingUnit" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "categoryId" TEXT,
  "categoryName" TEXT,
  "depositAmount" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackagingUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ArticleUnit" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "packagingUnitId" TEXT,
  "label" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArticleUnit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ArticleUnit"
  ADD COLUMN IF NOT EXISTS "packagingUnitId" TEXT;

ALTER TABLE "Barcode"
  ADD COLUMN IF NOT EXISTS "articleUnitId" TEXT;

CREATE TABLE IF NOT EXISTS "StockMovementBatch" (
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

ALTER TABLE "StockMovement"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT,
  ADD COLUMN IF NOT EXISTS "articleUnitId" TEXT,
  ADD COLUMN IF NOT EXISTS "unitLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "unitQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "unitCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "bookingReasonId" TEXT;

CREATE TABLE IF NOT EXISTS "BookingReason" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "movementType" "MovementType" NOT NULL,
  "stockKind" "StockKind",
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "noteRequired" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "permissionKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingReason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UiLabel" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "defaultLabel" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "area" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UiLabel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MenuConfig" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "icon" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "roleId" TEXT,
  "isStartPage" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MenuConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "area" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "entityLabel" TEXT,
  "articleId" TEXT,
  "warehouseId" TEXT,
  "locationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Permission_key_key" ON "Permission"("key");
CREATE INDEX IF NOT EXISTS "Permission_group_idx" ON "Permission"("group");
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX IF NOT EXISTS "Role_active_idx" ON "Role"("active");
CREATE INDEX IF NOT EXISTS "UserWarehouseAccess_warehouseId_idx" ON "UserWarehouseAccess"("warehouseId");
CREATE INDEX IF NOT EXISTS "UserLocationAccess_locationId_idx" ON "UserLocationAccess"("locationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Location_code_key" ON "Location"("code");
CREATE INDEX IF NOT EXISTS "Location_active_idx" ON "Location"("active");
CREATE INDEX IF NOT EXISTS "Location_sortOrder_idx" ON "Location"("sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "PackagingUnit_code_key" ON "PackagingUnit"("code");
CREATE INDEX IF NOT EXISTS "PackagingUnit_active_idx" ON "PackagingUnit"("active");
CREATE INDEX IF NOT EXISTS "PackagingUnit_sortOrder_idx" ON "PackagingUnit"("sortOrder");
CREATE INDEX IF NOT EXISTS "ArticleUnit_articleId_idx" ON "ArticleUnit"("articleId");
CREATE INDEX IF NOT EXISTS "ArticleUnit_active_idx" ON "ArticleUnit"("active");
CREATE INDEX IF NOT EXISTS "ArticleUnit_packagingUnitId_idx" ON "ArticleUnit"("packagingUnitId");
CREATE INDEX IF NOT EXISTS "Barcode_articleUnitId_idx" ON "Barcode"("articleUnitId");
CREATE INDEX IF NOT EXISTS "StockMovementBatch_createdAt_idx" ON "StockMovementBatch"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StockMovementBatch_idempotencyKey_key" ON "StockMovementBatch"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "StockMovementBatch_userId_idx" ON "StockMovementBatch"("userId");
CREATE INDEX IF NOT EXISTS "StockMovementBatch_warehouseId_idx" ON "StockMovementBatch"("warehouseId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingReason_code_key" ON "BookingReason"("code");
CREATE INDEX IF NOT EXISTS "BookingReason_movementType_idx" ON "BookingReason"("movementType");
CREATE INDEX IF NOT EXISTS "BookingReason_active_idx" ON "BookingReason"("active");
CREATE INDEX IF NOT EXISTS "BookingReason_sortOrder_idx" ON "BookingReason"("sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "UiLabel_key_key" ON "UiLabel"("key");
CREATE INDEX IF NOT EXISTS "UiLabel_area_idx" ON "UiLabel"("area");
CREATE INDEX IF NOT EXISTS "UiLabel_active_idx" ON "UiLabel"("active");
CREATE INDEX IF NOT EXISTS "MenuConfig_visible_idx" ON "MenuConfig"("visible");
CREATE INDEX IF NOT EXISTS "MenuConfig_sortOrder_idx" ON "MenuConfig"("sortOrder");
CREATE INDEX IF NOT EXISTS "MenuConfig_roleId_idx" ON "MenuConfig"("roleId");
CREATE UNIQUE INDEX IF NOT EXISTS "MenuConfig_key_roleId_key" ON "MenuConfig"("key", "roleId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_area_idx" ON "AuditLog"("area");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_articleId_idx" ON "AuditLog"("articleId");
CREATE INDEX IF NOT EXISTS "AuditLog_warehouseId_idx" ON "AuditLog"("warehouseId");
CREATE INDEX IF NOT EXISTS "AuditLog_locationId_idx" ON "AuditLog"("locationId");
CREATE INDEX IF NOT EXISTS "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX IF NOT EXISTS "Warehouse_locationId_idx" ON "Warehouse"("locationId");
CREATE INDEX IF NOT EXISTS "Warehouse_sortOrder_idx" ON "Warehouse"("sortOrder");
CREATE INDEX IF NOT EXISTS "StockMovement_batchId_idx" ON "StockMovement"("batchId");
CREATE INDEX IF NOT EXISTS "StockMovement_articleUnitId_idx" ON "StockMovement"("articleUnitId");
CREATE INDEX IF NOT EXISTS "StockMovement_bookingReasonId_idx" ON "StockMovement"("bookingReasonId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_roleId_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_permissionId_fkey') THEN
    ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserWarehouseAccess_userId_fkey') THEN
    ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserWarehouseAccess_warehouseId_fkey') THEN
    ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserLocationAccess_userId_fkey') THEN
    ALTER TABLE "UserLocationAccess" ADD CONSTRAINT "UserLocationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserLocationAccess_locationId_fkey') THEN
    ALTER TABLE "UserLocationAccess" ADD CONSTRAINT "UserLocationAccess_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArticleUnit_articleId_fkey') THEN
    ALTER TABLE "ArticleUnit" ADD CONSTRAINT "ArticleUnit_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArticleUnit_packagingUnitId_fkey') THEN
    ALTER TABLE "ArticleUnit" ADD CONSTRAINT "ArticleUnit_packagingUnitId_fkey" FOREIGN KEY ("packagingUnitId") REFERENCES "PackagingUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Barcode_articleUnitId_fkey') THEN
    ALTER TABLE "Barcode" ADD CONSTRAINT "Barcode_articleUnitId_fkey" FOREIGN KEY ("articleUnitId") REFERENCES "ArticleUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Warehouse_locationId_fkey') THEN
    ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovementBatch_userId_fkey') THEN
    ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovementBatch_warehouseId_fkey') THEN
    ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_batchId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockMovementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_articleUnitId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_articleUnitId_fkey" FOREIGN KEY ("articleUnitId") REFERENCES "ArticleUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_bookingReasonId_fkey') THEN
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_bookingReasonId_fkey" FOREIGN KEY ("bookingReasonId") REFERENCES "BookingReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MenuConfig_roleId_fkey') THEN
    ALTER TABLE "MenuConfig" ADD CONSTRAINT "MenuConfig_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_warehouseId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_locationId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
