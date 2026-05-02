import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { monthlyTargets } from "../../shared/schema.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
  ensureCenterAccess,
} from "../auth.js";
import {
  upsertMonthlyTargetsSchema,
  copyTargetsSchema,
} from "../../shared/validators.js";
import { writeAudit } from "../audit.js";

export const targetsRouter = Router();

targetsRouter.use(requireAuth, requirePasswordChanged);

targetsRouter.get("/", async (req, res) => {
  const user = req.session.user!;
  const centerId = String(req.query.centerId ?? "");
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!centerId || !Number.isFinite(year) || !Number.isFinite(month)) {
    res.status(400).json({ error: "centerId, year, month required" });
    return;
  }
  if (!ensureCenterAccess(user, centerId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select()
    .from(monthlyTargets)
    .where(
      and(
        eq(monthlyTargets.centerId, centerId),
        eq(monthlyTargets.year, year),
        eq(monthlyTargets.month, month),
      ),
    );
  res.json({ targets: rows });
});

targetsRouter.post(
  "/upsert",
  requireRole("admin", "manager"),
  async (req, res) => {
    const user = req.session.user!;
    const parsed = upsertMonthlyTargetsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    if (!ensureCenterAccess(user, data.centerId)) {
      res.status(403).json({ error: "Cannot set targets for another center" });
      return;
    }

    await db.transaction(async (tx) => {
      const before = await tx
        .select()
        .from(monthlyTargets)
        .where(
          and(
            eq(monthlyTargets.centerId, data.centerId),
            eq(monthlyTargets.year, data.year),
            eq(monthlyTargets.month, data.month),
          ),
        );

      for (const t of data.targets) {
        await tx
          .insert(monthlyTargets)
          .values({
            centerId: data.centerId,
            deviceId: t.deviceId,
            year: data.year,
            month: data.month,
            targetCount: t.targetCount,
            setBy: user.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              monthlyTargets.centerId,
              monthlyTargets.deviceId,
              monthlyTargets.year,
              monthlyTargets.month,
            ],
            set: {
              targetCount: t.targetCount,
              setBy: user.id,
              updatedAt: new Date(),
            },
          });
      }

      const after = await tx
        .select()
        .from(monthlyTargets)
        .where(
          and(
            eq(monthlyTargets.centerId, data.centerId),
            eq(monthlyTargets.year, data.year),
            eq(monthlyTargets.month, data.month),
          ),
        );

      await writeAudit(tx, {
        userId: user.id,
        action: "upsert",
        entity: "monthly_targets",
        entityId: `${data.centerId}/${data.year}-${data.month}`,
        before,
        after,
      });
    });

    res.json({ ok: true });
  },
);

targetsRouter.post(
  "/copy",
  requireRole("admin", "manager"),
  async (req, res) => {
    const user = req.session.user!;
    const parsed = copyTargetsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const data = parsed.data;
    if (!ensureCenterAccess(user, data.centerId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const copied = await db.transaction(async (tx) => {
      const source = await tx
        .select()
        .from(monthlyTargets)
        .where(
          and(
            eq(monthlyTargets.centerId, data.centerId),
            eq(monthlyTargets.year, data.fromYear),
            eq(monthlyTargets.month, data.fromMonth),
          ),
        );

      for (const s of source) {
        await tx
          .insert(monthlyTargets)
          .values({
            centerId: data.centerId,
            deviceId: s.deviceId,
            year: data.toYear,
            month: data.toMonth,
            targetCount: s.targetCount,
            setBy: user.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              monthlyTargets.centerId,
              monthlyTargets.deviceId,
              monthlyTargets.year,
              monthlyTargets.month,
            ],
            set: {
              targetCount: s.targetCount,
              setBy: user.id,
              updatedAt: new Date(),
            },
          });
      }

      await writeAudit(tx, {
        userId: user.id,
        action: "copy",
        entity: "monthly_targets",
        entityId: `${data.centerId}/${data.toYear}-${data.toMonth}`,
        before: { from: { year: data.fromYear, month: data.fromMonth } },
        after: { count: source.length },
      });

      return source.length;
    });

    res.json({ ok: true, copied });
  },
);
