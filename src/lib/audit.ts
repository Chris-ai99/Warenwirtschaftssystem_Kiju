import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";

type AuditTx = Prisma.TransactionClient;

export async function writeAuditLog(
  tx: AuditTx,
  input: {
    user?: CurrentUser | null;
    area: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    entityLabel?: string | null;
    articleId?: string | null;
    warehouseId?: string | null;
    locationId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await tx.auditLog.create({
    data: {
      userId: input.user?.id,
      area: input.area,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      articleId: input.articleId,
      warehouseId: input.warehouseId,
      locationId: input.locationId,
      metadata: input.metadata,
    },
  });
}
