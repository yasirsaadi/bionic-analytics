import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { centers, devices, users } from "../shared/schema.js";

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});
const db = drizzle(pool);

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

async function main(): Promise<void> {
  console.log("[seed] starting…");

  await db.transaction(async (tx) => {
    for (const c of CENTERS) {
      const existing = await tx
        .select()
        .from(centers)
        .where(eq(centers.nameEn, c.nameEn))
        .limit(1);
      if (existing.length === 0) {
        await tx.insert(centers).values(c);
        console.log(`[seed]   + center: ${c.nameEn}`);
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
        await tx.insert(devices).values({
          ...d,
          displayOrder: i + 1,
        });
        console.log(`[seed]   + device: ${d.code}`);
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
      console.log("[seed]   + admin user: admin / ChangeMe!2026");
    }
  });

  console.log("[seed] done.");
  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
