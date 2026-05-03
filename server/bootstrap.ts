import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.js";
import { centers, devices, users } from "../shared/schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsFolder(): string | null {
  const candidates = [
    path.resolve(here, "../../migrations"),
    path.resolve(here, "../migrations"),
    path.resolve(process.cwd(), "migrations"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "meta", "_journal.json"))) {
      return candidate;
    }
  }
  return null;
}

const CENTERS = [
  { nameAr: "الناصرية", nameEn: "Nasiriyah", city: "الناصرية" },
  { nameAr: "بغداد", nameEn: "Baghdad", city: "بغداد" },
  { nameAr: "كربلاء", nameEn: "Karbala", city: "كربلاء" },
  { nameAr: "الموصل", nameEn: "Mosul", city: "الموصل" },
  { nameAr: "كركوك", nameEn: "Kirkuk", city: "كركوك" },
];

const DEVICES = [
  { code: "megnatik", nameAr: "مغناطيس", nameEn: "Magnetic Therapy" },
  { code: "laser", nameAr: "ليزر", nameEn: "Laser" },
  { code: "tecar", nameAr: "تيكار", nameEn: "Tecar" },
  { code: "exercise", nameAr: "تمارين", nameEn: "Exercise" },
  { code: "ultrasound", nameAr: "أمواج فوق صوتية", nameEn: "Ultrasound" },
  { code: "traction", nameAr: "شد", nameEn: "Traction" },
  { code: "shockwaves", nameAr: "موجات صادمة", nameEn: "Shockwaves" },
  { code: "electro", nameAr: "كهربائي", nameEn: "Electrotherapy" },
  { code: "compression", nameAr: "ضغط", nameEn: "Compression" },
  { code: "infrared", nameAr: "أشعة تحت حمراء", nameEn: "Infrared" },
  { code: "hot_pack", nameAr: "كمادات حارة", nameEn: "Hot Pack" },
  { code: "wax", nameAr: "شمع", nameEn: "Wax" },
  { code: "cpm", nameAr: "تحريك مستمر", nameEn: "CPM" },
  { code: "robotik", nameAr: "روبوتيك", nameEn: "Robotik" },
  { code: "needle", nameAr: "إبر", nameEn: "Needle" },
];

async function runMigrations(): Promise<void> {
  const folder = resolveMigrationsFolder();
  if (!folder) {
    console.warn("[bootstrap] migrations folder not found; skipping migrate");
    return;
  }
  console.log(`[bootstrap] applying migrations from ${folder}`);
  await migrate(db, { migrationsFolder: folder });
  console.log("[bootstrap] migrations applied");
}

async function runSeed(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const c of CENTERS) {
      const existing = await tx
        .select()
        .from(centers)
        .where(eq(centers.nameEn, c.nameEn))
        .limit(1);
      if (existing.length === 0) {
        await tx.insert(centers).values(c);
        console.log(`[bootstrap]   + center: ${c.nameEn}`);
      }
    }

    for (let i = 0; i < DEVICES.length; i++) {
      const d = DEVICES[i]!;
      const existing = await tx
        .select()
        .from(devices)
        .where(eq(devices.code, d.code))
        .limit(1);
      if (existing.length === 0) {
        await tx.insert(devices).values({ ...d, displayOrder: i + 1 });
        console.log(`[bootstrap]   + device: ${d.code}`);
      }
    }

    const adminExisting = await tx
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);
    if (adminExisting.length === 0) {
      const passwordHash = await bcrypt.hash("ChangeMe!2026", 12);
      await tx.insert(users).values({
        fullName: "مدير النظام",
        username: "admin",
        passwordHash,
        role: "admin",
        centerId: null,
        mustChangePassword: true,
      });
      console.log("[bootstrap]   + admin user created");
    }
  });
}

export async function bootstrap(): Promise<void> {
  try {
    await runMigrations();
    await runSeed();
    console.log("[bootstrap] done");
  } catch (err) {
    console.error("[bootstrap] failed:", err);
    await pool.end().catch(() => {});
    throw err;
  }
}
