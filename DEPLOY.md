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
| `TELEGRAM_SOURCE_CHANNELS` | `@قناة1,@قناة2` | (اختياري) قنوات تيليجرام تقرأ منها |
| `FACEBOOK_SOURCE_PAGES` | `pageId1,pageSlug2` | (اختياري) صفحات فيسبوك تقرأ منها |
| `FACEBOOK_READ_TOKEN` | رمز صفحات | (اختياري) لقراءة صفحات المصادر |

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

## المهام المجدولة (Autopilot) — تشغيل الوكلاء دائماً ⭐

الوكلاء (الجامع، الراصد، المدقق، الصائغ، الناشر، المفنّد، الحارس) يجمعون الأخبار
من فيسبوك وتيليجرام، ويرصدون الشائعات، ويجهّزونها للمراجعة البشرية.

> **مهم:** الوكلاء لا يعملون من تلقاء أنفسهم على Vercel المجاني — خطة Vercel المجانية
> تسمح بمهمة مجدولة واحدة **يومياً** فقط. لذلك أضفنا حلاً مجانياً بالكامل يعمل كل
> **10 دقائق**: ملف `.github/workflows/agents.yml` يستخدم **GitHub Actions**.
> (دقائق GitHub Actions مجانية بلا حدود للمستودعات العامة — ومستودعك عام.)

### تشغيل الوكلاء كل 10 دقائق (خطوتان فقط)

اذهب إلى مستودعك على GitHub → **Settings → Secrets and variables → Actions**.

**الطريقة (أ) — الأسهل، وتستفيد من إعدادات Vercel نفسها:**
1. تبويب **Secrets** → **New repository secret**:
   - الاسم: `CRON_SECRET` — القيمة: نفس القيمة التي وضعتها في Vercel.
2. تبويب **Variables** → **New repository variable**:
   - الاسم: `PLATFORM_URL` — القيمة: رابط موقعك مثل `https://taiznow.vercel.app`.

**الطريقة (ب) — تشغيل الوكلاء مباشرة على قاعدة البيانات (لا تحتاج موقعاً حياً):**
1. تبويب **Secrets** → أضف `DATABASE_URL` (رابط Neon/Pooled).
2. (اختياري) أضف مفاتيح التشغيل الحقيقي: `GROQ_API_KEY` (ذكاء اصطناعي مجاني)،
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` (للنشر على قناتك),
   `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` (للنشر على صفحتك),
   `FACEBOOK_READ_TOKEN` (لقراءة صفحات المصادر).
3. تبويب **Variables** → أضف المصادر التي تريد مراقبتها:
   - `TELEGRAM_SOURCE_CHANNELS` = `@قناة1,@قناة2` (قنوات **أخرى** تقرأ منها).
   - `FACEBOOK_SOURCE_PAGES` = `pageId1,pageSlug2` (صفحات **أخرى** تقرأ منها).

بعد الإضافة، افتح تبويب **Actions** → اختر **AI Agents Autopilot** → **Run workflow**
لتشغيل أول دورة فوراً والتأكد أنها تعمل. بعدها ستعمل تلقائياً كل 10 دقائق.

> يمكنك استخدام الطريقتين معاً — الوركفلو يجرّب (أ) أولاً ثم (ب) تلقائياً.

### كيف تتحقق أن الوكلاء يعملون؟
من داخل المنصة: افتح **/agents** (لوحة الوكلاء). سترى لكل وكيل عدد مرات التشغيل
وآخر تشغيل وملخص آخر دورة. على Vercel، افتح **Actions** في GitHub وسترى كل دورة
ناجحة في السجل.

### (اختياري) تشغيل يومي على Vercel أيضاً
`vercel.json` يسجّل مهمة يومية على `/api/cron/tick`. المسار محمي بـ `CRON_SECRET`
ولا يمكن لأحد تشغيله من الخارج.

---

## توحيد مشاريع Vercel (احتفظ بمشروع واحد فقط) 🧹

قد يكون لديك أكثر من مشروع Vercel مربوط بنفس المستودع، وهذا سبب رئيسي لتكرار
الفشل والارتباك. الأفضل أن يبقى **مشروع واحد** فقط.

1. افتح <https://vercel.com/dashboard> وسجّل الدخول.
2. سترى عدة مشاريع بنفس الاسم تقريباً (`taiz-now`, `taiz-now-s5jv`, `taiz-now-ibjx`,
   `taiz-now--public`).
3. اختر **المشروع الذي تريد إبقاءه** — هو الذي:
   - يحتوي قاعدة البيانات (تبويب **Storage** فيه Postgres)، و
   - يحتوي كل متغيّرات البيئة (تبويب **Settings → Environment Variables**).
4. في بقية المشاريع: **Settings → General → Delete Project** → احذفها.
   > لا تقلق: حذف المشروع لا يحذف كودك من GitHub إطلاقاً.

### إيقاف حماية النشر (سبب ظهور «Protected by Vercel Authentication»)

إن كان موقعك يطلب تسجيل دخول Vercel عند فتحه، فهذه **حماية النشر** مفعّلة بالخطأ:

1. افتح المشروع → **Settings → Deployment Protection**.
2. عند **Vercel Authentication** اختر **Disabled** (أو **Standard Protection** فقط
   للنشرات التجريبية، مع إبقاء **Production** عاماً).
3. احفظ. الآن يستطيع أي شخص فتح موقعك، وتعمل الطريقة (أ) في الوكلاء.

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
- [ ] مشروع Vercel واحد فقط (احذف المكرر)
- [ ] حماية النشر (Deployment Protection) معطّلة للـ Production
- [ ] أسرار GitHub Actions مضبوطة (`CRON_SECRET` + `PLATFORM_URL` أو `DATABASE_URL`)
- [ ] تغيير كلمة سر المدير
- [ ] اختبار الدخول + إرسال بلاغ + نشر منشور

---

## روابط سريعة

- **Vercel:** <https://vercel.com/new>
- **Neon (قاعدة بيانات مجانية):** <https://neon.tech>
- **Groq (ذكاء اصطناعي مجاني):** <https://console.groq.com/keys>
- **توليد سر عشوائي:** <https://generate-secret.vercel.app/32>
