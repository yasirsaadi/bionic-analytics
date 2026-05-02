export type UserRole = "admin" | "manager" | "reception";
export type Shift = "morning" | "evening";

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  centerId: string | null;
  mustChangePassword: boolean;
}

export interface Center {
  id: string;
  nameAr: string;
  nameEn: string;
  city: string;
  isActive: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface UserRow {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  centerId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface DailySessionRow {
  id: string;
  centerId: string;
  sessionDate: string;
  shift: Shift;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCount {
  id: string;
  dailySessionId: string;
  deviceId: string;
  count: number;
}

export interface MonthlyTarget {
  id: string;
  centerId: string;
  deviceId: string;
  year: number;
  month: number;
  targetCount: number;
  setBy: string;
  updatedAt: string;
}
