import { auditLog } from "../shared/schema.js";
import type { DB } from "./db.js";

export type AuditTx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export interface AuditEntry {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function writeAudit(
  tx: AuditTx,
  entry: AuditEntry,
): Promise<void> {
  await tx.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    beforeJson: (entry.before ?? null) as never,
    afterJson: (entry.after ?? null) as never,
  });
}
