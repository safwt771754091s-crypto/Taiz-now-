# 🚀 دليل نشر منصة «تعز الآن» على الإنترنت (دائم)

هذا الدليل يشرح خطوة بخطوة كيف ترفع المنصة على استضافة دائمة، ليراها الجميع
على رابط ثابت مثل `https://taiznow.ye`.

المنصة جاهزة للنشر بالكامل: لا تكتب أي ملفات على القرص، تعمل على أي استضافة
حديثة، وفيها مسار خاص للمهام المجدولة (`/api/cron/tick`) يعمل تلقائياً.

---

## الخيار الأسرع: Vercel (مجاني للبداية) ⭐

Vercel هي شركة صانعة Next.js — النشر عليها بضغطة واحدة من GitHub.

### الخطوة 1 — قاعدة بيانات مجانية (Neon)
1. افتح <https://neon.tech> وسجّل بحساب GitHub.
2. أنشئ مشروعاً جديداً (Project) باسم `taiznow`.
3. من **Connection Details** انسخ **رابطين**:
   - **Pooled connection** (فيه `-pooler`) → هذا `DATABASE_URL` (للتطبيق).
   - **Direct connection** (بدون `-pooler`) → هذا `DIRECT_URL` (للترحيلات).
   - ⚠️ مهم: الترحيلات تحتاج الاتصال المباشر، وإلا يفشل البناء.

### الخطوة 2 — ارفع المشروع على Vercel
1. افتح <https://vercel.com/new>.
2. اختر **Import Git Repository** ثم اختر `safwt771754091s-crypto/Taiz-now-`.
3. اترك الإعدادات الافتراضية (Vercel يقرأ `vercel.json` تلقائياً).

### الخطوة 3 — أضف متغيرات البيئة (Environment Variables)
في صفحة الاستيراد اضغط **Environment Variables** وأضف:

| الاسم | القيمة | ملاحظة |
|---|---|---|
| `DATABASE_URL` | رابط Neon (Pooled) | **إلزامي** |
| `DIRECT_URL` | رابط Neon (Direct، بدون `-pooler`) | للترحيلات (أو اتركه فارغاً) |
| `AUTH_SECRET` | نص عشوائي طويل | **إلزامي** — ولّده من <https://generate-secret.vercel.app/32> |
| `AUTH_TRUST_HOST` | `true` | **إلزامي** خلف Vercel |
| `NEXTAUTH_URL` | `https://<اسم-مشروعك>.vercel.app` | بعد النشر حدّثه للنطاق النهائي |
| `PLATFORM_URL` | `https://<اسم-مشروعك>.vercel.app` | لبناء الروابط |
| `CRON_SECRET` | نص عشوائي | **إلزامي** لتشغيل المهام المجدولة |
| `GROQ_API_KEY` | مفتاح من <https://console.groq.com/keys> | مجاني — يفعّل الذكاء الاصطناعي |
| `OLLAMA_ENABLED` | `false` | مهم: لا يوجد Ollama على Vercel |

> ⚠️ **لا تضع** `OLLAMA_BASE_URL` على Vercel إطلاقاً.

### الخطوة 4 — انشر
اضغط **Deploy**. سيبني Vercel المنصة تلقائياً (يشمل تشغيل migrations).

### الخطوة 5 — أنشئ حساب المدير
بعد نجاح النشر، افتح Terminal محلياً (أو من جهازك) ونفّذ مرة واحدة:

```bash
DATABASE_URL="<رابط-Neon>" npx prisma db seed
```

> أو من Vercel: أضف `SEED_ON_BOOT=true` مؤقتاً ثم أعد النشر، ثم أزله.

بيانات الدخول الافتراضية:
```
owner@taiznow.ye  /  password
```
**غيّرها فوراً بعد أول دخول.**

### الخطوة 6 — اربط نطاقك الخاص (اختياري)
1. من لوحة Vercel: **Settings → Domains → Add**.
2. اكتب `taiznow.ye` واتبع تعليمات DNS.
3. حدّث `NEXTAUTH_URL` و `PLATFORM_URL` للنطاق الجديد وأعد النشر.

---

## الخيار الأسهل: Vercel Postgres (بلا موقع خارجي) ⭐⭐

إن لم ترغب بفتح حساب Neon، أنشئ قاعدة البيانات من داخل Vercel نفسه:

1. افتح مشروعك على Vercel → تبويب **Storage**.
2. اضغط **Create Database** → اختر **Postgres** → أنشئه.
3. اضغط **Connect Project** واختر مشروعك. سيضيف Vercel المتغيّرات **تلقائياً**.
4. لا تحتاج لنسخ أي رابط يدوياً — المنصة تتعرّف على أسماء متغيّرات Vercel
   (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`,
   `POSTGRES_URL_NON_POOLING`) تلقائياً.
5. أضف فقط المتغيّرات غير الخاصة بقاعدة البيانات: `AUTH_SECRET`, `AUTH_TRUST_HOST`,
   `NEXTAUTH_URL`, `PLATFORM_URL`, `CRON_SECRET`, `OLLAMA_ENABLED=false`.
6. أعد النشر (**Redeploy**).

> ملاحظة: المنصة تقبل أيضاً أسماء Neon (`DATABASE_URL` / `DIRECT_URL`) — أي مزوّد
> Postgres قياسي يعمل.

---

## الخيار الثاني: خادم دائم (Railway / Render / VPS)

المنصة فيها `Dockerfile` جاهز. أي استضافة تدعم Docker ستعمل.

1. أنشئ خدمة **PostgreSQL** من لوحة الاستضافة.
2. أنشئ خدمة **Web** من المستودع (Dockerfile).
3. أضف نفس متغيرات البيئة أعلاه + `SEED_ON_BOOT=true` (مرة واحدة).
4. المنصة تشغّل حلقة المهام المجدولة داخلياً تلقائياً عبر `docker-entrypoint.sh`.

---

## المهام المجدولة (Autopilot)

الوكلاء (الجامع، المدقق، الكاتب، الناشر...) تعمل دورياً:

- **Vercel:** `vercel.json` يسجّل مهمة يومية على `/api/cron/tick`.
  > ملاحظة: خطة Vercel المجانية تسمح بمهمة واحدة **يومياً** فقط. للحصول على
  > تحديث كل 10 دقائق، رقِّ الخطة إلى Pro، أو استخدم خدمة جدولة خارجية مجانية
  > مثل <https://cron-job.org> تنادي الرابط:
  > `https://<نطاقك>/api/cron/tick` مع ترويسة
  > `Authorization: Bearer <CRON_SECRET>`.
- **خادم دائم:** `docker-entrypoint.sh` ينادي نفس المسار كل 5 دقائق تلقائياً.

المسار محمي بـ `CRON_SECRET` — لا يمكن لأحد تشغيله من الخارج.

---

## ⚠️ حل مشكلة البناء: «Could not load --schema from prisma/schema.prisma»

إذا ظهر في سجل النشر على Vercel هذا الخطأ:

```
Error: Could not load `--schema` from provided path `prisma/schema.prisma`: file or directory not found
```

فالسبب ليس الكود — الملف موجود في المستودع. السبب أن **مشروع Vercel هذا مضبوط على
«مجلد جذر» (Root Directory) خاطئ**، فيبدأ البناء من مجلد فرعي لا يحتوي مجلد `prisma`.
هذا يحدث عندما يكون لديك أكثر من مشروع Vercel مربوط بنفس المستودع.

### الحل (دقيقة واحدة)

1. افتح <https://vercel.com/dashboard> واختر المشروع الذي **فشل** (مثلاً `taiz-now--public`).
2. **Settings → Build & Deployment → Root Directory**.
3. اترك الخانة **فارغة تماماً** (أو اضغط «Edit» ثم امسح أي قيمة) واحفظ.
   > الخانة الفارغة تعني «جذر المستودع» — وهو المكان الصحيح.
4. ارجع إلى **Deployments** واضغط **Redeploy** على آخر نشرة.
5. تأكد أيضاً أن **Framework Preset = Next.js** و**Build Command** فارغ
   (Vercel سيقرأ الأمر الصحيح من ملف `vercel.json` تلقائياً).

### إن تكرر الخطأ
- احذف المشروع المكرر من Vercel: يكفيك **مشروع واحد** مربوط بالمستودع.
  المشاريع المكررة (`taiz-now--public`, `taiz-now-s5jv`, `taiz-now-ibjx`) تُنشئ نفس
  البناء عدة مرات وتُربك الإعدادات. احتفظ بمشروع واحد فقط (`taiz-now`) واحذف الباقي
  من **Project Settings → General → Delete Project**.
- بعدها أعد الربط من <https://vercel.com/new> واختر المستودع مرة واحدة.

> ملاحظة تقنية: أضفنا `scripts/build.mjs` الذي يجد جذر المستودع تلقائياً حتى لو بدأ
> البناء من مجلد فرعي، لكن إن كان المشروع يشير إلى مستودع/فرع آخر فلا بد من تصحيح
> «Root Directory» يدوياً كما في الخطوات أعلاه.

---

## قائمة التحقق قبل الإطلاق ✅

- [ ] قاعدة بيانات Postgres (Pooled) جاهزة
- [ ] `DATABASE_URL` مضبوط
- [ ] `AUTH_SECRET` عشوائي وطويل
- [ ] `CRON_SECRET` مضبوط
- [ ] `NEXTAUTH_URL` و `PLATFORM_URL` = النطاق الحقيقي
- [ ] `OLLAMA_ENABLED=false` (على Vercel)
- [ ] مفتاح AI (Groq أو OpenAI)
- [ ] تغيير كلمة سر المدير
- [ ] اختبار الدخول + إرسال بلاغ + نشر منشور

---

## روابط سريعة

- **Vercel:** <https://vercel.com/new>
- **Neon (قاعدة بيانات مجانية):** <https://neon.tech>
- **Groq (ذكاء اصطناعي مجاني):** <https://console.groq.com/keys>
- **توليد سر عشوائي:** <https://generate-secret.vercel.app/32>
