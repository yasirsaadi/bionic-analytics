import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { users } from "../../shared/schema.js";
import {
  loginSchema,
  changePasswordSchema,
} from "../../shared/validators.js";
import { requireAuth, type SessionUser } from "../auth.js";
import { writeAudit } from "../audit.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { username, password } = parsed.data;
  const found = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const u = found[0];
  if (!u || !u.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const sessionUser: SessionUser = {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    centerId: u.centerId,
    mustChangePassword: u.mustChangePassword,
  };
  req.session.user = sessionUser;
  await writeAudit(db, {
    userId: u.id,
    action: "login",
    entity: "user",
    entityId: u.id,
  });
  res.json({ user: sessionUser });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const userId = req.session.user?.id ?? null;
  req.session.destroy(() => {
    void writeAudit(db, {
      userId,
      action: "logout",
      entity: "user",
      entityId: userId,
    });
    res.json({ ok: true });
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const found = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
  const u = found[0];
  if (!u) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const ok = await bcrypt.compare(parsed.data.currentPassword, u.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newHash, mustChangePassword: false })
      .where(eq(users.id, u.id));
    await writeAudit(tx, {
      userId: u.id,
      action: "change_password",
      entity: "user",
      entityId: u.id,
    });
  });
  req.session.user = { ...sessionUser, mustChangePassword: false };
  res.json({ ok: true });
});
