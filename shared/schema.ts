import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  pgEnum,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "reception",
]);

export const shiftEnum = pgEnum("shift", ["morning", "evening"]);

export const centers = pgTable("centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  city: text("city").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  centerId: uuid("center_id").references(() => centers.id),
  fullName: text("full_name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const dailySessions = pgTable(
  "daily_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centerId: uuid("center_id")
      .notNull()
      .references(() => centers.id),
    sessionDate: date("session_date").notNull(),
    shift: shiftEnum("shift").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueSession: unique("daily_sessions_center_date_shift_uq").on(
      t.centerId,
      t.sessionDate,
      t.shift,
    ),
  }),
);

export const sessionCounts = pgTable(
  "session_counts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailySessionId: uuid("daily_session_id")
      .notNull()
      .references(() => dailySessions.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    uniqueDevice: unique("session_counts_session_device_uq").on(
      t.dailySessionId,
      t.deviceId,
    ),
    countNonNeg: check("session_counts_count_nonneg", sql`${t.count} >= 0`),
  }),
);

export const monthlyTargets = pgTable(
  "monthly_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    centerId: uuid("center_id")
      .notNull()
      .references(() => centers.id),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    targetCount: integer("target_count").notNull().default(0),
    setBy: uuid("set_by")
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueTarget: unique("monthly_targets_center_device_year_month_uq").on(
      t.centerId,
      t.deviceId,
      t.year,
      t.month,
    ),
    monthRange: check(
      "monthly_targets_month_range",
      sql`${t.month} >= 1 AND ${t.month} <= 12`,
    ),
    targetNonNeg: check(
      "monthly_targets_target_nonneg",
      sql`${t.targetCount} >= 0`,
    ),
  }),
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Center = typeof centers.$inferSelect;
export type NewCenter = typeof centers.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DailySession = typeof dailySessions.$inferSelect;
export type NewDailySession = typeof dailySessions.$inferInsert;
export type SessionCount = typeof sessionCounts.$inferSelect;
export type NewSessionCount = typeof sessionCounts.$inferInsert;
export type MonthlyTarget = typeof monthlyTargets.$inferSelect;
export type NewMonthlyTarget = typeof monthlyTargets.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type Shift = (typeof shiftEnum.enumValues)[number];
