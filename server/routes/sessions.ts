import { Router } from "express";
import { and, eq, gte, lte, sum } from "drizzle-orm";
import { db } from "../db.js";
import { dailySessions, sessionCounts } from "../../shared/schema.js";
import {
  requireAuth,
  requirePasswordChanged,
  ensureCenterAccess,
} from "../auth.js";
import {
  upsertDailySessionSchema,
  sessionsFilterSchema,
} from "../../shared/validators.js";
import { writeAudit } from "../audit.js";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth, requirePasswordChanged);

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

sessionsRouter.get("/", async (req, res) => {
  const user = req.session.user!;
  const parsed = sessionsFilterSchema.safeParse({
    centerId: req.query.centerId,
    from: req.query.from,
    to: req.query.to,
    shift: req.query.shift,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid filters", details: parsed.error.flatten() });
    return;
  }
  const f = parsed.data;
  const effectiveCenterId =
    user.role === "admin" ? f.centerId : (user.centerId ?? undefined);
  if (user.role !== "admin" && f.centerId && f.centerId !== user.centerId) {
    res.status(403).json({ error: "Cannot view another center" });
    return;
  }

  const conditions = [];
  if (effectiveCenterId)
    conditions.push(eq(dailySessions.centerId, effectiveCenterId));
  if (f.from) conditions.push(gte(dailySessions.sessionDate, f.from));
  if (f.to) conditions.push(lte(dailySessions.sessionDate, f.to));
  if (f.shift) conditions.push(eq(dailySessions.shift, f.shift));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      sessionId: dailySessions.id,
      centerId: dailySessions.centerId,
      sessionDate: dailySessions.sessionDate,
      shift: dailySessions.shift,
      updatedAt: dailySessions.updatedAt,
      deviceId: sessionCounts.deviceId,
      count: sessionCounts.count,
    })
    .from(dailySessions)
    .leftJoin(
      sessionCounts,
      eq(sessionCounts.dailySessionId, dailySessions.id),
    )
    .where(where)
    .orderBy(dailySessions.sessionDate);

  res.json({ rows });
});

sessionsRouter.get("/by", async (req, res) => {
  const user = req.session.user!;
  const centerId = String(req.query.centerId ?? "");
  const sessionDate = String(req.query.sessionDate ?? "");
  const shift = String(req.query.shift ?? "");
  if (!centerId || !sessionDate || !shift) {
    res.status(400).json({ error: "centerId, sessionDate, shift required" });
    return;
  }
  if (!ensureCenterAccess(user, centerId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const session = (
    await db
      .select()
      .from(dailySessions)
      .where(
        and(
          eq(dailySessions.centerId, centerId),
          eq(dailySessions.sessionDate, sessionDate),
          eq(dailySessions.shift, shift as "morning" | "evening"),
        ),
      )
      .limit(1)
  )[0];

  if (!session) {
    res.json({ session: null, counts: [] });
    return;
  }

  const counts = await db
    .select()
    .from(sessionCounts)
    .where(eq(sessionCounts.dailySessionId, session.id));

  res.json({ session, counts });
});

sessionsRouter.post("/upsert", async (req, res) => {
  const user = req.session.user!;
  const parsed = upsertDailySessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (!ensureCenterAccess(user, data.centerId)) {
    res.status(403).json({ error: "Forbidden — different center" });
    return;
  }

  if (user.role === "reception") {
    if (data.sessionDate !== todayIso()) {
      res.status(403).json({ error: "Reception can only edit today's sessions" });
      return;
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(dailySessions)
          .where(
            and(
              eq(dailySessions.centerId, data.centerId),
              eq(dailySessions.sessionDate, data.sessionDate),
              eq(dailySessions.shift, data.shift),
            ),
          )
          .limit(1)
      )[0];

      if (existing && user.role === "reception") {
        const ageMs = Date.now() - new Date(existing.createdAt).getTime();
        if (ageMs > 24 * 60 * 60 * 1000) {
          throw new Error("Session is older than 24h — reception cannot edit");
        }
      }

      let sessionId: string;
      let beforeSession = existing;
      if (existing) {
        const [updated] = await tx
          .update(dailySessions)
          .set({ updatedAt: new Date() })
          .where(eq(dailySessions.id, existing.id))
          .returning();
        sessionId = updated!.id;
      } else {
        const [inserted] = await tx
          .insert(dailySessions)
          .values({
            centerId: data.centerId,
            sessionDate: data.sessionDate,
            shift: data.shift,
            createdBy: user.id,
          })
          .returning();
        sessionId = inserted!.id;
      }

      const beforeCounts = await tx
        .select()
        .from(sessionCounts)
        .where(eq(sessionCounts.dailySessionId, sessionId));

      for (const c of data.counts) {
        await tx
          .insert(sessionCounts)
          .values({
            dailySessionId: sessionId,
            deviceId: c.deviceId,
            count: c.count,
          })
          .onConflictDoUpdate({
            target: [sessionCounts.dailySessionId, sessionCounts.deviceId],
            set: { count: c.count },
          });
      }

      const afterCounts = await tx
        .select()
        .from(sessionCounts)
        .where(eq(sessionCounts.dailySessionId, sessionId));

      await writeAudit(tx, {
        userId: user.id,
        action: existing ? "update" : "create",
        entity: "daily_session",
        entityId: sessionId,
        before: { session: beforeSession ?? null, counts: beforeCounts },
        after: { sessionId, counts: afterCounts },
      });

      return { sessionId };
    });

    res.json({ ok: true, sessionId: result.sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    res.status(400).json({ error: message });
  }
});

sessionsRouter.get("/monthly-actuals", async (req, res) => {
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
  const monthStr = String(month).padStart(2, "0");
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const rows = await db
    .select({
      deviceId: sessionCounts.deviceId,
      total: sum(sessionCounts.count).as("total"),
    })
    .from(sessionCounts)
    .innerJoin(
      dailySessions,
      eq(sessionCounts.dailySessionId, dailySessions.id),
    )
    .where(
      and(
        eq(dailySessions.centerId, centerId),
        gte(dailySessions.sessionDate, from),
        lte(dailySessions.sessionDate, to),
      ),
    )
    .groupBy(sessionCounts.deviceId);

  res.json({
    actuals: rows.map((r) => ({
      deviceId: r.deviceId,
      total: Number(r.total ?? 0),
    })),
  });
});
