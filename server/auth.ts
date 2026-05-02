import type { RequestHandler } from "express";
import type { UserRole } from "../shared/schema.js";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  centerId: string | null;
  mustChangePassword: boolean;
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
};

export const requirePasswordChanged: RequestHandler = (req, res, next) => {
  if (req.session.user?.mustChangePassword) {
    res.status(403).json({ error: "Password change required" });
    return;
  }
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function ensureCenterAccess(
  user: SessionUser,
  centerId: string,
): boolean {
  if (user.role === "admin") return true;
  return user.centerId === centerId;
}
