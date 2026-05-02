import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { devices } from "../../shared/schema.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../auth.js";
import {
  createDeviceSchema,
  updateDeviceSchema,
} from "../../shared/validators.js";
import { writeAudit } from "../audit.js";

export const devicesRouter = Router();

devicesRouter.use(requireAuth, requirePasswordChanged);

devicesRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(devices).orderBy(devices.displayOrder);
  res.json({ devices: rows });
});

devicesRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  try {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(devices).values(parsed.data).returning();
      await writeAudit(tx, {
        userId: req.session.user?.id ?? null,
        action: "create",
        entity: "device",
        entityId: row?.id,
        after: row,
      });
      return row;
    });
    res.status(201).json({ device: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insert failed";
    res.status(400).json({ error: message });
  }
});

devicesRouter.patch("/:id", requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  const parsed = updateDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const before = (
      await tx.select().from(devices).where(eq(devices.id, id)).limit(1)
    )[0];
    if (!before) return null;
    const [row] = await tx
      .update(devices)
      .set(parsed.data)
      .where(eq(devices.id, id))
      .returning();
    await writeAudit(tx, {
      userId: req.session.user?.id ?? null,
      action: "update",
      entity: "device",
      entityId: id,
      before,
      after: row,
    });
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "Device not found" });
    return;
  }
  res.json({ device: updated });
});
