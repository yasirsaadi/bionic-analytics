import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../shared/schema.js";
import {
  requireAuth,
  requirePasswordChanged,
  requireRole,
} from "../auth.js";
import {
  createUserSchema,
  resetPasswordSchema,
} from "../../shared/validators.js";
import { writeAudit } from "../audit.js";

export const usersRouter = Router();

usersRouter.use(requireAuth, requirePasswordChanged, requireRole("admin"));

usersRouter.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      centerId: users.centerId,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.fullName);
  res.json({ users: rows });
});

usersRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { fullName, username, password, role, centerId } = parsed.data;
  if (role !== "admin" && !centerId) {
    res
      .status(400)
      .json({ error: "Manager and reception users must have a center" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          fullName,
          username,
          passwordHash,
          role,
          centerId: role === "admin" ? null : centerId,
          mustChangePassword: true,
        })
        .returning({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          centerId: users.centerId,
          isActive: users.isActive,
        });
      await writeAudit(tx, {
        userId: req.session.user?.id ?? null,
        action: "create",
        entity: "user",
        entityId: row?.id,
        after: row,
      });
      return row;
    });
    res.status(201).json({ user: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insert failed";
    res.status(400).json({ error: message });
  }
});

usersRouter.patch("/:id/active", async (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "Missing id" });
    return;
  }
  const isActive = Boolean(req.body?.isActive);
  const updated = await db.transaction(async (tx) => {
    const before = (
      await tx.select().from(users).where(eq(users.id, id)).limit(1)
    )[0];
    if (!before) return null;
    const [row] = await tx
      .update(users)
      .set({ isActive })
      .where(eq(users.id, id))
      .returning();
    await writeAudit(tx, {
      userId: req.session.user?.id ?? null,
      action: isActive ? "activate" : "deactivate",
      entity: "user",
      entityId: id,
      before,
      after: row,
    });
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ok: true });
});

usersRouter.post("/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.id, parsed.data.userId));
    await writeAudit(tx, {
      userId: req.session.user?.id ?? null,
      action: "reset_password",
      entity: "user",
      entityId: parsed.data.userId,
    });
  });
  res.json({ ok: true });
});
