# كيفية تطبيق patch على bionic-centers-manager

ملف
`session-tracking-merge.patch`
يحتوي على جميع تغييرات قسم متابعة الجلسات. أُعدّ ضمن جلسة لا تملك صلاحية كتابة على
- بايونك سنترز منجر
- لذا لم يُدفع مباشرة. الطريقة الأسهل لتطبيقه: جلسة
- كلود كود
- جديدة مفتوحة على المستودع الكبير، أو من سطر أوامر شخصي.

## ملخّص ما يحتويه الـpatch

كومت واحد، ١٣ ملف:

- `server/migrations/009_session_tracking.ts` (جديد) — إنشاء ٤ جداول، إضافة ٣ صلاحيات، بذر ١٥ جهاز.
- `server/migrations/runner.ts` — تسجيل migration الجديد.
- `server/sessions_module/permissions.ts` (جديد) — helpers للصلاحيات.
- `server/sessions_module/routes.ts` (جديد) — ٧ مسارات تحت `/api/session-tracking/*`.
- `server/routes.ts` — استدعاء `registerSessionTrackingRoutes` + ضمّ ٣ صلاحيات للـ branchSession.
- `shared/schema.ts` — تعريف ٤ جداول جديدة + ٣ أعمدة على `system_users`.
- `client/src/pages/SessionEntry.tsx` (جديد) — صفحة الإدخال اليومي.
- `client/src/pages/SessionTargets.tsx` (جديد) — صفحة الأهداف الشهرية.
- `client/src/pages/SessionsList.tsx` (جديد) — صفحة التقرير + تصدير CSV.
- `client/src/App.tsx` — ٣ مسارات أمامية جديدة.
- `client/src/components/Sidebar.tsx` — ٣ بنود قائمة جانبية.
- `client/src/hooks/usePermissions.ts` — إضافة الصلاحيات الجديدة.
- `client/src/i18n/translations.ts` — مفاتيح ترجمة عربي/إنكليزي.

اختُبر:
- `npx tsc --noEmit`: صفر أخطاء جديدة.
- `npm run build`: نجح. الصفحات الثلاث صُنّفت ضمن chunks (~5KB لكل واحدة).

## المسار الموصى به: جلسة كلود كود جديدة

١. افتح جلسة
- كلود كود
- جديدة مفتوحة على مستودع
`yasirsaadi/bionic-centers-manager`.

٢. أعطها هذا الطلب:

> "حمّل الـ patch من
> `https://raw.githubusercontent.com/yasirsaadi/bionic-analytics/main/patches/session-tracking-merge.patch`
> ، أنشئ فرع
> `feature/session-tracking-module`
> من
> `main`،
> طبّق الـpatch بأمر
> `git am`،
> ثمّ ادفع الفرع، وأخبرني عند انتهاء النشر التلقائي على
> Render
> لكي أتحقّق من
> /api/session-tracking/devices."

الجلسة الجديدة ستنفّذ كلّ هذا في ٣٠ ثانية بأوامر مثل:

```bash
curl -L -o /tmp/sessions.patch \
  https://raw.githubusercontent.com/yasirsaadi/bionic-analytics/main/patches/session-tracking-merge.patch
git checkout -b feature/session-tracking-module
git am /tmp/sessions.patch
git push -u origin feature/session-tracking-module
```

ثم تفتح
PR
بعنوان
`Phase 1 — Session tracking module (merge from bionic-analytics)`.

## المسار البديل: من حاسوبك أنت

إذا كان عندك سطر أوامر مع وصول للمستودع:

```bash
# 1. clone (إن لم يكن عندك)
git clone https://github.com/yasirsaadi/bionic-centers-manager.git
cd bionic-centers-manager

# 2. حمّل الـpatch
curl -L -o /tmp/sessions.patch \
  https://raw.githubusercontent.com/yasirsaadi/bionic-analytics/main/patches/session-tracking-merge.patch

# 3. أنشئ فرعاً وطبّق
git checkout -b feature/session-tracking-module
git am /tmp/sessions.patch

# 4. ادفع
git push -u origin feature/session-tracking-module
```

ثم افتح
PR
يدوياً من واجهة GitHub.

## بعد الدفع: ماذا يحدث على Render

١. Render
سيلتقط الفرع تلقائياً (إذا فعّلت
auto-deploy
على فرعك). إن لم يكن، يتطلّب الدمج إلى
`main`
لكي يُعاد النشر.

٢. عند بدء التشغيل، ينفّذ
`runMigrations()`
migration ٠٠٩
مرّة واحدة:
- ينشئ ٤ جداول جديدة
- يضيف ٣ أعمدة على `system_users`
- يبذر ١٥ جهاز
- يُحدّث صلاحيات reception و branch_manager الموجودين

٣. ستظهر سجلّات في
Logs:
```
[migrations] applying 009_session_tracking ...
[migrations] applied 009_session_tracking
```

## الاختبار السريع بعد النشر

١. افتح:
`https://bionic-centers-manager.onrender.com/api/session-tracking/devices`
بعد تسجيل دخولك. يجب أن تظهر قائمة ١٥ جهاز.

٢. ادخل قسم
**إدخال الجلسات**
من القائمة الجانبية، اختر الفرع، أدخل أعداداً، احفظ.

٣. ادخل
**أهداف الجلسات**،
عيّن أهداف الشهر، احفظ.

٤. ارجع لـ
**إدخال الجلسات**
وراقب أشرطة التقدّم بدأت تظهر بنسب الإنجاز.

## التراجع إذا حدث خطأ

١. كود: `git revert HEAD` على
`main`،
سيعيد Render النشر فوراً للحالة السابقة.

٢. قاعدة بيانات: الجداول الأربعة الجديدة منفصلة. لا حاجة لاستعادة. لو أردت إزالة كاملة:
```sql
DROP TABLE IF EXISTS session_counts CASCADE;
DROP TABLE IF EXISTS daily_sessions CASCADE;
DROP TABLE IF EXISTS monthly_targets CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TYPE IF EXISTS shift;
ALTER TABLE system_users
  DROP COLUMN IF EXISTS can_enter_sessions,
  DROP COLUMN IF EXISTS can_manage_session_targets,
  DROP COLUMN IF EXISTS can_view_sessions_report;
DELETE FROM _migrations WHERE name = '009_session_tracking';
```

٣. كارثة: استعادة من فرع Neon
`backup-before-sessions-merge-2026-05-03`
الذي أنشأته قبل البدء.
