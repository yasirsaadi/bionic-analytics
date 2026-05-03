# خطة دمج bionic-analytics في bionic-centers-manager

> **الحالة:** مسوّدة للمراجعة. لا تغييرات على الكود حتى الموافقة.
> **الهدف:** نقل ميزة "متابعة الجلسات اليومية" (إدخال أعداد الأجهزة لكل مركز/يوم/وردية + أهداف شهرية) لتصبح قسماً داخل التطبيق الكبير، مع تسجيل دخول واحد.
> **النسخة الاحتياطية:** فرع Neon `backup-before-sessions-merge-2026-05-03` ✅

---

## ١. اكتشافات مهمّة من فحص المستودع الكبير

غيّرت هذه الاكتشافات افتراضاتي السابقة:

| الموضوع | ما اكتشفناه |
|---|---|
| المصادقة | **ليست passport** رغم وجوده في package.json. الفعلي: session cookie مخصّصة، الهوية في `req.session.branchSession`. |
| Migrations | **ليست drizzle-kit migrate**. ملفات TS مخصّصة في `server/migrations/` مع runner داخلي. آخرها `008_visit_permissions.ts`. الإضافة فقط، ممنوع الحذف. |
| البناء | esbuild يحزم الخادم في `dist/index.cjs` (CJS مفرد)، Vite يبني العميل في `dist/public`. |
| الأدوار | ٦ أدوار: `admin / branch_manager / accountant / reception / therapist / surveyor` + ١٥ صلاحية دقيقة. |
| الجلسات | لا helper مثل `requireRole(...)`. التحقّق من الصلاحيات مكتوب يدوياً داخل كل route. |
| الجداول الموجودة | `visits` و `audit_log` و `branches` و `system_users` موجودة وتُستخدم. |
| الجداول غير الموجودة | `daily_sessions` و `session_counts` و `monthly_targets` و `devices` — كلّها جديدة. |
| Routing الأمامي | `wouter` (ليس `react-router-dom`). |
| واجهة API | TanStack Query، اتفاقية: مفتاح الاستعلام = أجزاء URL مفصولة بـ `/`. |

---

## ٢. ملاحظة معماريّة قبل البدء

التطبيق الكبير يملك جدول `visits` فيه **صف لكلّ زيارة مريض**:
`treatmentType, sessionCount, cost, shift, branchId, createdBy`.

تطبيقنا الأصلي يعتمد **عدّاً مجمّعاً** للمركز/اليوم/الوردية لكلّ جهاز من الـ ١٥ جهازاً، **بدون ربط بمريض محدّد**.

### الخياران

**أ. الإبقاء على نموذج العدّ المجمّع (موصى به للدمج الحالي):**
- نضيف ٤ جداول جديدة (`devices`, `daily_sessions`, `session_counts`, `monthly_targets`).
- لا تعديل على `visits`. الميزتان (تسجيل الزيارات وعدّ الأجهزة) تتعايشان.
- ✅ سريع، لا خطر على البيانات الحالية، نُسلّم القيمة المطلوبة في Phase 1 الأصلي.
- ❌ تكرار ظاهري: المستقبل يُسجّل زيارة المريض، ثمّ يُسجّل عدّ الأجهزة المجمّع. (لكنّ هذا هو ما طلبته المواصفة الأصلية حرفياً.)

**ب. توحيد عبر visits (إعادة هيكلة):**
- إضافة جدول وسيط `visit_devices(visit_id, device_id, count)` لتسجيل أيّ أجهزة استُخدمت في كلّ زيارة.
- اشتقاق العدّ المجمّع لكلّ مركز/يوم بـ SQL.
- ✅ مصدر حقيقة وحيد.
- ❌ يعيد كتابة معنى `visits.treatmentType`، يحتاج migration بياناتي، ويُعطّل تقارير موجودة.

**التوصية:** الخيار **أ** الآن. إن أردت لاحقاً، نلتقي على الخيار ب في Phase 2 من الدمج.

---

## ٣. تغييرات قاعدة البيانات (إضافية فقط، صفر مخاطر)

### جداول جديدة

```sql
-- shift enum (موجود بالفعل في تطبيقنا، نضيفه في التطبيق الكبير)
DO $$ BEGIN
  CREATE TYPE shift AS ENUM ('morning', 'evening');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ١. الأجهزة (15 جهازاً)
CREATE TABLE IF NOT EXISTS devices (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name_ar       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ٢. الجلسات اليومية (سجل واحد لكل مركز/يوم/وردية)
CREATE TABLE IF NOT EXISTS daily_sessions (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER NOT NULL REFERENCES branches(id),
  session_date  DATE NOT NULL,
  shift         shift NOT NULL,
  created_by    INTEGER NOT NULL REFERENCES system_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, session_date, shift)
);

-- ٣. عدّ الأجهزة لكل جلسة يومية
CREATE TABLE IF NOT EXISTS session_counts (
  id                 SERIAL PRIMARY KEY,
  daily_session_id   INTEGER NOT NULL REFERENCES daily_sessions(id) ON DELETE CASCADE,
  device_id          INTEGER NOT NULL REFERENCES devices(id),
  count              INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  UNIQUE (daily_session_id, device_id)
);

-- ٤. الأهداف الشهرية لكل مركز/جهاز
CREATE TABLE IF NOT EXISTS monthly_targets (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER NOT NULL REFERENCES branches(id),
  device_id     INTEGER NOT NULL REFERENCES devices(id),
  year          INTEGER NOT NULL,
  month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_count  INTEGER NOT NULL DEFAULT 0 CHECK (target_count >= 0),
  set_by        INTEGER NOT NULL REFERENCES system_users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, device_id, year, month)
);
```

### تغييرات على جداول موجودة
**لا شيء.** صفر `ALTER` على جداول الإنتاج.

### استخدام audit_log الموجود
نُلحق به سجلات بـ `entityType` جديدة: `daily_session`, `monthly_target`. لا تغيير مخطّط.

### Seed
١٥ صفّاً في `devices` بنفس الترتيب من تطبيقنا الأصلي. يُشغَّل مرّة واحدة في migration بشرط `IF NOT EXISTS`.

### الملف الفعلي
ملف TypeScript واحد:
`server/migrations/009_session_tracking.ts`
بنفس نمط `008_visit_permissions.ts`، يُستدعى من `server/migrations/runner.ts`.

---

## ٤. تغييرات الخادم

### ملفات جديدة

| ملف | محتوى |
|---|---|
| `server/sessions_module/routes.ts` | راوت `/api/session-tracking/*` (انظر التفاصيل أدناه) |
| `server/sessions_module/permissions.ts` | helper لفحص الصلاحيات (تعتمد على `branchSession`) |
| `server/migrations/009_session_tracking.ts` | إنشاء الجداول الأربعة + بذر الأجهزة |

### تعديل ملفّين موجودَين

**`server/routes.ts`** — إضافة سطر واحد بعد آخر `app.use(...)`:
```ts
import { registerSessionTrackingRoutes } from "./sessions_module/routes.js";
// ...داخل registerRoutes...
registerSessionTrackingRoutes(app, isAuthenticated);
```

**`server/migrations/runner.ts`** — إضافة سطر واحد لتسجيل migration الجديد:
```ts
import { migration009 } from "./009_session_tracking.js";
// ضمن قائمة migrations
{ name: "009_session_tracking", run: migration009 },
```

### المسارات المضافة (`/api/session-tracking/*`)

| Method | Path | مَن | يفعل |
|---|---|---|---|
| GET | `/api/session-tracking/devices` | الجميع المصادَقون | قائمة الأجهزة الفعّالة بالترتيب |
| GET | `/api/session-tracking/daily?branchId=&date=&shift=` | حسب الصلاحية | جلسة يوم محدّد + عدادات الأجهزة |
| POST | `/api/session-tracking/daily/upsert` | reception/manager/admin | upsert ذرّي للجلسة + كل العدّادات داخل transaction |
| GET | `/api/session-tracking/monthly?branchId=&year=&month=` | حسب الصلاحية | فعليّ + هدف لكل جهاز |
| POST | `/api/session-tracking/targets/upsert` | manager/admin | حفظ أهداف شهرية |
| POST | `/api/session-tracking/targets/copy` | manager/admin | نسخ أهداف من شهر لآخر |
| GET | `/api/session-tracking/list?branchId=&from=&to=` | manager/admin | قائمة جلسات مع pivot ضمن النطاق الزمني |

### قواعد الصلاحيات

- `admin`: كل شيء، أيّ مركز.
- `branch_manager`: مركزه فقط (مع دعم `branchIds` متعدّد). يحرّر الأهداف والجلسات (بدون قيد ٢٤ ساعة).
- `reception`: مركزه فقط، إدخال **اليوم الحالي فقط** (بتوقيت بغداد عبر `server/timezone.ts` الموجود)، تعديل في حدود ٢٤ ساعة من إنشاء السجل.
- `accountant / therapist / surveyor`: قراءة فقط لمركزهم (إن أردت — يمكن منعهم تماماً).

### Audit
كل `POST` يُلحق سجلاً في `audit_log` بـ `entityType ∈ {daily_session, monthly_target}` و `oldValues / newValues` JSON.

---

## ٥. تغييرات الواجهة

### ملفات جديدة

| ملف | محتوى |
|---|---|
| `client/src/pages/SessionEntry.tsx` | إدخال يومي: محدّد مركز + تاريخ + وردية + شبكة ١٥ جهازاً مع شريط تقدّم شهري ملوّن (أحمر <70%، كهرماني 70-99%، أخضر ≥100%). |
| `client/src/pages/SessionTargets.tsx` | جدول أهداف شهرية، زر "نسخ من شهر سابق". |
| `client/src/pages/SessionsList.tsx` | جدول pivot (تاريخ × جهاز) مع تصدير CSV من العميل. |
| `client/src/lib/sessionTrackingApi.ts` | wrappers على TanStack Query لكل endpoint. |
| `client/src/i18n/sessionTracking.ar.ts` و `.en.ts` | نصوص الترجمة. |

### تعديل ملفّين موجودَين

**`client/src/App.tsx`** — إضافة ٣ مسارات داخل `<Switch>`:
```tsx
<Route path="/session-tracking/entry" component={SessionEntry} />
<Route path="/session-tracking/targets" component={SessionTargets} />
<Route path="/session-tracking/list" component={SessionsList} />
```

**`client/src/components/Sidebar.tsx`** — إضافة ٣ بنود إلى `baseMenuItems`:

```ts
{
  labelKey: "sidebar.sessionEntry",
  href: "/session-tracking/entry",
  icon: Activity,
  permission: "canAddPatients", // أو نضيف صلاحية مخصّصة لاحقاً
},
{
  labelKey: "sidebar.sessionTargets",
  href: "/session-tracking/targets",
  icon: Target,
  adminOnly: false, // mgr/admin فقط — يُتحكَّم بصلاحية مضافة
},
{
  labelKey: "sidebar.sessionsList",
  href: "/session-tracking/list",
  icon: BarChart3,
  permission: "canViewReports",
},
```

### اتّساق التصميم
استخدام مكوّنات Radix UI/shadcn الموجودة (`Card, Input, Select, Button, Toast`) بدلاً من مكوّناتنا الخامة في تطبيق `bionic-analytics`، حتى يبدو القسم جزءاً طبيعياً من التطبيق.

### RTL والترجمة
يستخدم `LanguageProvider` الموجود ومفاتيح ترجمة. لا حاجة لإعادة بناء بنية RTL.

---

## ٦. الترجمة بين الـ schemas

| في `bionic-analytics` (الأصل) | في التطبيق الكبير بعد الدمج |
|---|---|
| `centers (uuid)` | `branches (serial integer)` ← موجود |
| `users (uuid, role enum admin/manager/reception)` | `system_users (serial integer, text role 6 قيم)` ← موجود |
| `daily_sessions.center_id (uuid)` | `daily_sessions.branch_id (integer FK)` |
| `daily_sessions.created_by (uuid)` | `daily_sessions.created_by (integer FK system_users)` |
| `monthly_targets.center_id` | `monthly_targets.branch_id` |
| `monthly_targets.set_by` | `monthly_targets.set_by (integer FK system_users)` |
| `audit_log` (مخصّص لنا) | إعادة استخدام `audit_log` الموجود |
| الدور `manager` | الدور `branch_manager` |

---

## ٧. خطوات التسليم

ترتيب العمل المقترح، فرع واحد `feature/session-tracking-module` في مستودع `bionic-centers-manager`:

١. **Migration** — `009_session_tracking.ts` + قيد في `runner.ts`.
٢. **Backend** — مجلد `server/sessions_module/` ومسار التسجيل.
٣. **Frontend** — صفحات + روتر + سايدبار + ترجمة.
٤. **اختبارات يدوية** على فرع Neon احتياطي (سأنشئ فرعاً ثانياً مخصّصاً للاختبار).
٥. **PR على main** للمراجعة. لا merge بدون إذنك.

---

## ٨. خطّة الاختبار قبل merge

١. تشغيل التطبيق محلياً مقابل فرع Neon اختبار، تشغيل migration، التحقّق من إنشاء الجداول الأربعة وبذر ١٥ جهازاً.
٢. تسجيل دخول كـ admin → فتح `/session-tracking/entry` → اختيار مركز → إدخال أعداد → حفظ → تحقّق من سجل `audit_log`.
٣. تسجيل دخول كـ branch_manager (مركز Baghdad) → التحقّق من عدم رؤية مراكز أخرى → إدخال هدف شهري → حفظ.
٤. تسجيل دخول كـ reception → محاولة إدخال تاريخ غير اليوم → يُرفض → محاولة تعديل سجل قديم بعد ٢٤ ساعة → يُرفض.
٥. التحقّق من أنّ الميزات الموجودة (Patients, Visits, Payments, Accounting, Surveys) لم تتأثّر.
٦. تشغيل البناء `npm run build` والتأكّد من نجاحه.

---

## ٩. خطّة الرجوع (rollback)

في حال حدوث مشكلة بعد deploy:

١. **مستوى الكود:** revert الـ commit على `main`، Render يعيد النشر تلقائياً.
٢. **مستوى قاعدة البيانات:** الجداول الأربعة الجديدة مستقلّة. حذفها يدوياً لا يؤثّر على البيانات الموجودة:
   ```sql
   DROP TABLE IF EXISTS session_counts CASCADE;
   DROP TABLE IF EXISTS daily_sessions CASCADE;
   DROP TABLE IF EXISTS monthly_targets CASCADE;
   DROP TABLE IF EXISTS devices CASCADE;
   DROP TYPE IF EXISTS shift;
   ```
٣. **حالة كارثيّة:** استعادة من فرع Neon `backup-before-sessions-merge-2026-05-03`.

---

## ١٠. ما لن يحدث

- ❌ لا تعديل على `users`, `system_users`, `branches`, `patients`, `visits`, `payments`, `documents`, `expenses`, `invoices`, `journal_entries`، إلخ.
- ❌ لا حذف بيانات.
- ❌ لا `drizzle-kit push` ولا `migrate` تلقائي بطريقة جديدة — نتبع نظامكم الحالي.
- ❌ لا تغيير على آلية المصادقة أو الجلسة.
- ❌ لا merge على main بدون مراجعتك.
- ❌ لن نلمس مستودع `bionic-analytics` خلال هذه المرحلة. يمكن إيقاف خدمته على Render بعد التحقّق من نجاح الدمج.

---

## ١١. مصير bionic-analytics بعد الدمج

١. اختبار كامل للقسم الجديد داخل `bionic-centers-manager`.
٢. تأكيد عمل كلّ الميزات في الإنتاج لمدّة ٧ أيام.
٣. إيقاف خدمة `bionic-analytics` على Render (ليست حذف؛ Suspend ليمكن إعادتها لو لزم).
٤. حذف فرع Neon احتياطنا `backup-before-sessions-merge-2026-05-03` بعد ٣٠ يوماً (تحقّق نهائي ثمّ حذف).
٥. أرشفة مستودع `bionic-analytics` على GitHub (Settings → Archive).

---

## ١٢. ما أحتاجه منك الآن

1. **مراجعة هذه الوثيقة.**
2. **قرار في النقاط الجوهريّة التالية:**

   **أ. الخيار المعماري:** الموافقة على الخيار **أ** (نموذج العدّ المجمّع) أم تفضّل المسار **ب** (التوحيد عبر visits)؟

   **ب. الصلاحية المستخدمة لدخول قسم الجلسات:**
   - استخدام صلاحية موجودة (`canAddPatients` لـ Entry، `canViewReports` لـ List)؟
   - أم نضيف ٣ صلاحيات جديدة في `system_users`: `canEnterSessions`, `canManageSessionTargets`, `canViewSessionsReport`؟
   (الإضافة أنظف لكنّها تتطلّب migration بسيط لإضافة أعمدة جديدة على `system_users`.)

   **ج. وصول الأدوار غير الأساسية:**
   - `accountant`, `therapist`, `surveyor` — هل يحقّ لهم رؤية تقارير الجلسات؟ افتراضياً **لا** ما لم تعطِهم `canViewReports`.

   **د. الوصول للمستودع الكبير:**
   إذا كان لديّ صلاحية كتابة على `bionic-centers-manager` عبر GitHub App، سأنشئ الفرع وأرفع الكود مباشرة. وإلا، سأكتب الملفات هنا وأعطيك أوامر لتطبيقها.

3. **بعد إجاباتك:**
   - أبدأ التنفيذ على فرع `feature/session-tracking-module`.
   - أفتح PR للمراجعة.
   - **لا merge** قبل إذنك.

---

**آخر تحديث:** 2026-05-03 — مسوّدة أوّليّة.
