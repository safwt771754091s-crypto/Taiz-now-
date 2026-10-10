import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { score } from "../src/lib/confidence";
import { draftSocialPosts } from "../src/lib/ai";
import { AGENT_CATALOG } from "../src/lib/agents/catalog";
import { PROVIDERS } from "../src/lib/social/providers";
import { getBrand, updateBrand } from "../src/lib/platform/brand";
import { ensurePlatformEmails } from "../src/lib/platform/email";
import { ensureSystemPages } from "../src/lib/platform/pages";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password";

async function seedUsers() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Prisma.UserCreateInput[] = [
    { email: "owner@taiznow.ye", name: "مدير المنصة", role: "OWNER", passwordHash: hash },
    { email: "editor@taiznow.ye", name: "محرر الأخبار", role: "EDITOR", passwordHash: hash },
    { email: "factcheck@taiznow.ye", name: "مدقق الحقائق", role: "FACT_CHECKER", passwordHash: hash },
    { email: "media@taiznow.ye", name: "محلل إعلامي", role: "MEDIA_ANALYST", passwordHash: hash },
    { email: "geo@taiznow.ye", name: "محلل جغرافي", role: "GEO_ANALYST", passwordHash: hash },
    { email: "social@taiznow.ye", name: "الناشر الاجتماعي", role: "SOCIAL_PUBLISHER", passwordHash: hash },
    { email: "viewer@taiznow.ye", name: "مشاهد", role: "VIEWER", passwordHash: hash },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: u });
  }
  return prisma.user.findUniqueOrThrow({ where: { email: "factcheck@taiznow.ye" } });
}

async function seedSources() {
  const data: Prisma.SourceCreateInput[] = [
    { name: "المركز اليمني للإعلام", type: "official", reliability: 85, url: "https://example.ye" },
    { name: "شهود عيان في الميدان", type: "eyewitness", reliability: 55 },
    { name: "وكالات أنباء دولية", type: "media", reliability: 80 },
    { name: "منصات التواصل الاجتماعي", type: "social", reliability: 25 },
    { name: "أرشيف مفتوح المصدر (OSINT)", type: "archive", reliability: 70 },
  ];
  const created = [];
  for (const s of data) {
    const existing = await prisma.source.findFirst({ where: { name: s.name } });
    created.push(existing ?? (await prisma.source.create({ data: s })));
  }
  return created;
}

async function createContent(input: {
  kind: "NEWS" | "RUMOR" | "CORRECTION";
  slug: string;
  title: string;
  summary: string;
  body: string;
  claim?: string;
  correctionNote?: string;
  location?: string;
  tags: string[];
  status: "VERIFIED" | "PUBLISHED";
  signals: Parameters<typeof score>[0];
  authorId: string;
  reviewerId: string;
  evidence: { type: Prisma.EvidenceCreateWithoutContentItemInput["type"]; title: string; note?: string; sourceId?: string }[];
}) {
  const result = score(input.signals);
  const existing = await prisma.contentItem.findUnique({ where: { slug: input.slug } });
  if (existing) return existing;

  const item = await prisma.contentItem.create({
    data: {
      kind: input.kind,
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      claim: input.claim,
      correctionNote: input.correctionNote,
      location: input.location,
      tags: input.tags,
      status: input.status,
      verdict: result.verdict,
      confidence: result.total,
      publishedAt: new Date(),
      lastReviewedAt: new Date(),
      createdById: input.authorId,
      reviewedById: input.reviewerId,
      evidence: { create: input.evidence },
      scores: {
        create: {
          entityType: "ContentItem",
          entityId: "pending",
          sourceScore: input.signals.source ?? 0,
          contentScore: input.signals.content ?? 0,
          imageScore: input.signals.image ?? 0,
          videoScore: input.signals.video ?? 0,
          contextScore: input.signals.context ?? 0,
          humanScore: input.signals.human ?? 0,
          total: result.total,
          verdict: result.verdict,
          computedById: input.reviewerId,
          breakdown: result as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });
  await prisma.confidenceRecord.updateMany({
    where: { entityType: "ContentItem", entityId: "pending", contentItemId: item.id },
    data: { entityId: item.id },
  });
  return item;
}

async function main() {
  const reviewer = await seedUsers();
  const sources = await seedSources();
  const [official, eyewitness, intl, social, osint] = sources;

  const news = await createContent({
    kind: "NEWS",
    slug: "taiz-ceasefire-local-agreement",
    title: "توقيع اتفاق محلي لوقف إطلاق النار في تعز",
    summary:
      "أفادت مصادر محلية ودولية بتوقيع اتفاق لوقف إطلاق النار في تعز، وقد تم التحقق من الخبر عبر تقاطع مصادر مستقلة.",
    body:
      "تأكد فريق التحقق من وقوع الاتفاق عبر ثلاثة مصادر مستقلة على الأقل، إضافة إلى وثيقة موقّعة تمت مراجعتها.\n\nأظهر التحقق الزمني تطابق تاريخ الوثيقة مع إعلان الأطراف. لا توجد مؤشرات على تلاعب بالصور المرفقة، وتم التحقق الجغرافي من موقع التوقيع.\n\nمنهجية التحقق: تقاطع المصادر الرسمية مع شهادات ميدانية ووثيقة أصلية.",
    location: "تعز",
    tags: ["تعز", "هدنة", "اليمن"],
    status: "PUBLISHED",
    authorId: reviewer.id,
    reviewerId: reviewer.id,
    signals: { source: 92, content: 88, image: 90, video: 0, context: 85, human: 95 },
    evidence: [
      { type: "DOCUMENT", title: "نسخة الوثيقة الموقّعة", sourceId: official.id, note: "تمت مطابقة التوقيعات" },
      { type: "SOURCE", title: "تأكيد من مصدرين مستقلين", sourceId: intl.id },
      { type: "GEO", title: "تحقق جغرافي من موقع التوقيع", sourceId: osint.id },
    ],
  });

  await createContent({
    kind: "NEWS",
      slug: "taiz-hospital-restores-emergency-services",
    title: "استعادة الخدمات الطارئة في مستشفى تعز العام",
    summary: "أعلنت إدارة المستشفى عودة قسم الطوارئ للعمل بعد صيانة، وقد تم التحقق من الخبر ميدانياً.",
    body:
      "زار فريق التحقق المستشفى وتأكد من عمل قسم الطوارئ، واتقاطع ذلك مع بيان صادر عن إدارة المستشفى وصور حديثة ذات بيانات وصفية سليمة.\n\nلم تُرصد أي مؤشرات على أن الصور مولّدة بالذكاء الاصطناعي، وطابق التحقق الجغرافي موقع المستشفى.",
    location: "تعز — الحصب",
    tags: ["صحة", "تعز"],
    status: "VERIFIED",
    authorId: reviewer.id,
    reviewerId: reviewer.id,
    signals: { source: 88, content: 82, image: 86, video: 0, context: 78, human: 90 },
    evidence: [
      { type: "SOURCE", title: "بيان إدارة المستشفى", sourceId: official.id },
      { type: "IMAGE", title: "صور حديثة للطوارئ", sourceId: eyewitness.id },
    ],
  });

  await createContent({
    kind: "RUMOR",
    slug: "rumor-fake-explosion-video",
    title: "شائعة: مقطع فيديو يزعم وقوع انفجار في وسط تعز",
    summary: "انتشر مقطع يزعم وقوع انفجار، لكن التحقق أثبت أن الفيديو قديم ومعاد استخدامه خارج سياقه.",
    claim: "مقطع يزعم وقوع انفجار ضخم في وسط تعز اليوم.",
    body:
      "كشف البحث العكسي أن المقطع منشور منذ سنوات في مدينة أخرى. كما أظهر تحليل البيانات الوصفية عدم تطابق التاريخ، ولم يصدر أي تأكيد رسمي.\n\nالخلاصة: الفيديو مضلل ومعاد استخدامه.",
    location: "تعز",
    tags: ["شائعة", "فيديو", "تضليل"],
    status: "PUBLISHED",
    authorId: reviewer.id,
    reviewerId: reviewer.id,
    signals: { source: 20, content: 35, image: 0, video: 15, context: 30, human: 25 },
    evidence: [
      { type: "VIDEO", title: "نتيجة البحث العكسي (نسخة أقدم)", sourceId: osint.id },
      { type: "SOURCE", title: "لا يوجد تأكيد رسمي", sourceId: official.id },
    ],
  });

  await createContent({
    kind: "RUMOR",
    slug: "rumor-fabricated-image-ai",
    title: "شائعة: صورة مولّدة بالذكاء الاصطناعي تزعم حادثة",
    summary: "صورة متداولة تبيّن أنها مولّدة بالذكاء الاصطناعي بناءً على آثار توليد وتحليل البيانات الوصفية.",
    claim: "صورة تزعم وقوع حادثة مرورية كبيرة.",
    body:
      "أظهرت أدوات كشف التوليد بالذكاء الاصطناعي نسبة مرتفعة جداً، كما غابت البيانات الوصفية تماماً وظهرت آثار غير طبيعية في تفاصيل الصورة.\n\nالخلاصة: الصورة مفبركة.",
    tags: ["صورة", "ذكاء اصطناعي", "تضليل"],
    status: "PUBLISHED",
    authorId: reviewer.id,
    reviewerId: reviewer.id,
    signals: { source: 15, content: 30, image: 12, video: 0, context: 25, human: 20 },
    evidence: [
      { type: "IMAGE", title: "تحليل كشف التوليد بالذكاء الاصطناعي", sourceId: osint.id, note: "احتمال توليد 92%" },
    ],
  });

  await createContent({
    kind: "CORRECTION",
    slug: "correction-earlier-casualty-figure",
    title: "تصحيح: عدد المصابين في الحادثة كان مبالغاً فيه",
    summary: "نشرنا سابقاً رقماً غير دقيق لعدد المصابين، وهذه تصحيح مبني على بيانات المستشفى الرسمية.",
    correctionNote: "الرقم الصحيح 7 مصابين، وليس 25 كما ورد في التقرير الأول.",
    body:
      "راجعنا تقريرنا الأول وتبيّن أن الرقم مبالغ فيه. المصدر الرسمي (سجل المستشفى) يوثق 7 إصابات.\n\nنعتذر عن الخطأ ونلتزم بالشفافية الكاملة في التصحيح.",
    location: "تعز",
    tags: ["تصحيح", "شفافية"],
    status: "PUBLISHED",
    authorId: reviewer.id,
    reviewerId: reviewer.id,
    signals: { source: 95, content: 90, image: 0, video: 0, context: 92, human: 95 },
    evidence: [{ type: "DOCUMENT", title: "سجل الحالات الرسمي", sourceId: official.id }],
  });

  // Map markers for verified events and rumors.
  const markerCount = await prisma.mapMarker.count();
  if (markerCount === 0) {
    await prisma.mapMarker.createMany({
      data: [
        {
          label: "اتفاق وقف إطلاق النار",
          lat: 13.5795,
          lng: 44.0209,
          category: "verified",
          description: "موقع التوقيع — تم التحقق جغرافياً",
          confidence: 90,
          contentItemId: news.id,
        },
        {
          label: "شائعة انفجار (مفبركة)",
          lat: 13.5789,
          lng: 44.0219,
          category: "rumor",
          description: "فيديو قديم معاد استخدامه",
          confidence: 25,
        },
        {
          label: "مستشفى تعز العام",
          lat: 13.5666,
          lng: 44.0333,
          category: "verified",
          description: "عودة خدمات الطوارئ",
          confidence: 86,
        },
      ],
    });
  }

  // Social drafts for the top published news item.
  const socialCount = await prisma.socialPost.count();
  if (socialCount === 0) {
    const drafts = draftSocialPosts({
      title: news.title,
      summary: news.summary,
      confidence: news.confidence,
      verdictLabel: "صحيح",
      slug: news.slug,
    });
    await prisma.socialPost.createMany({
      data: drafts.map((d) => ({ platform: d.platform, body: d.body, status: "draft", contentItemId: news.id })),
    });
  }

  // AI agent catalog + platform social identities (idempotent, no network calls).
  for (const def of AGENT_CATALOG) {
    await prisma.agent.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        role: def.role,
        kind: def.kind,
        description: def.description,
        config: { capabilities: def.capabilities },
      },
      update: {
        name: def.name,
        role: def.role,
        kind: def.kind,
        description: def.description,
        config: { capabilities: def.capabilities },
      },
    });
  }

  for (const def of PROVIDERS) {
    await prisma.socialConnection.upsert({
      where: { provider: def.provider },
      create: {
        provider: def.provider,
        displayName: def.label,
        mode: "MOCK",
        enabled: true,
        handle: `${def.handlePrefix}taiznow`,
        accountName: "تعز الآن",
      },
      update: { displayName: def.label },
    });
    await prisma.platformIdentity.upsert({
      where: { provider: def.provider },
      create: { provider: def.provider, handle: `${def.handlePrefix}taiznow` },
      update: {},
    });
  }
  await prisma.platformIdentity.upsert({
    where: { provider: "google" },
    create: { provider: "google", email: "taiznow@gmail.com", handle: "taiznow", connected: true, linkedVia: "google" },
    update: { email: "taiznow@gmail.com", connected: true, linkedVia: "google" },
  });

  // Platform brand + official mailboxes + page registry (idempotent).
  const brand = await getBrand();
  await updateBrand(brand, null);
  await ensurePlatformEmails(brand.name);
  const pageCount = await ensureSystemPages();
  const emailCount = await prisma.platformEmailAccount.count();

  console.log(`Seed complete: users, sources, content, markers, social drafts, agents, connections, ${pageCount} pages, ${emailCount} mailboxes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
