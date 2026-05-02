import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "manager", "reception"]);
export const shiftSchema = z.enum(["morning", "evening"]);

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must differ from current",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const countValueSchema = z
  .number({ invalid_type_error: "Must be a number" })
  .int("Must be an integer")
  .min(0, "Must be >= 0")
  .max(10_000, "Too large");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const sessionCountInputSchema = z.object({
  deviceId: z.string().uuid(),
  count: countValueSchema,
});

export const upsertDailySessionSchema = z.object({
  centerId: z.string().uuid(),
  sessionDate: isoDate,
  shift: shiftSchema,
  counts: z.array(sessionCountInputSchema).min(1),
});
export type UpsertDailySessionInput = z.infer<typeof upsertDailySessionSchema>;

export const targetRowSchema = z.object({
  deviceId: z.string().uuid(),
  targetCount: countValueSchema,
});

export const upsertMonthlyTargetsSchema = z.object({
  centerId: z.string().uuid(),
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  targets: z.array(targetRowSchema).min(1),
});
export type UpsertMonthlyTargetsInput = z.infer<
  typeof upsertMonthlyTargetsSchema
>;

export const copyTargetsSchema = z.object({
  centerId: z.string().uuid(),
  fromYear: z.number().int().min(2024).max(2100),
  fromMonth: z.number().int().min(1).max(12),
  toYear: z.number().int().min(2024).max(2100),
  toMonth: z.number().int().min(1).max(12),
});
export type CopyTargetsInput = z.infer<typeof copyTargetsSchema>;

export const createUserSchema = z.object({
  fullName: z.string().min(1).max(120),
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, digits, _ . - only"),
  password: z.string().min(8).max(128),
  role: userRoleSchema,
  centerId: z.string().uuid().nullable(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8).max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createCenterSchema = z.object({
  nameAr: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
});
export type CreateCenterInput = z.infer<typeof createCenterSchema>;

export const updateCenterSchema = createCenterSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateCenterInput = z.infer<typeof updateCenterSchema>;

export const createDeviceSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, digits, _ only"),
  nameAr: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(120),
  displayOrder: z.number().int().min(0).max(9999),
});
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

export const updateDeviceSchema = createDeviceSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

export const sessionsFilterSchema = z.object({
  centerId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  shift: shiftSchema.optional(),
});
export type SessionsFilterInput = z.infer<typeof sessionsFilterSchema>;
