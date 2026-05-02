import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { centers } from "../../shared/schema.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../auth.js";
import {
  createCenterSchema,
  updateCenterSchema,
} from "../../shared/validators.js";
import { writeAudit } from "../audit.js";

export const centersRouter = Router();

centersRouter.use(requireAuth, requirePasswordChanged);

centersRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(centers).orderBy(centers.nameAr);
  res.json({ centers: rows });
});

centersRouter.post("/", requireRole("admin"), async (req, res) => {
  const parsed = createCenterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(centers).values(parsed.data).returning();
    await writeAudit(tx, {
      userId: req.session.user?.id ?? null,
      action: "create",
      entity: "center",
      entityId: row?.id,
      after: row,
    });
    return row;
  });
  res.status(201).json({ center: created });
});

centersRouter.patch("/:id", requireRole("admin"), async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  const parsed = updateCenterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const before = (
      await tx.select().from(centers).where(eq(centers.id, id)).limit(1)
    )[0];
    if (!before) return null;
    const [row] = await tx
      .update(centers)
      .set(parsed.data)
      .where(eq(centers.id, id))
      .returning();
    await writeAudit(tx, {
      userId: req.session.user?.id ?? null,
      action: "update",
      entity: "center",
      entityId: id,
      before,
      after: row,
    });
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "Center not found" });
    return;
  }
  res.json({ center: updated });
});
