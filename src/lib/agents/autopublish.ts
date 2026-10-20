import { prisma } from "@/lib/prisma";
import { score } from "@/lib/confidence";

/**
 * Corroboration-based auto-publish for NEWS.
 *
 * A fact-checking platform must never publish on a single anonymous claim, and
 * the offline heuristic score alone can never clear the "likely" band for
 * text-only news (the documented weights cap around 70 without media signals).
 * So the gate here is editorial, not numeric: a collected NEWS item is published
 * only when the SAME story is independently carried by at least
 * AUTO_PUBLISH_MIN_SOURCES known-reputable publishers. That is the same test a
 * human desk applies, and it is fully explainable in the audit trail.
 *
 * RUMOR and CORRECTION are never auto-published: they require a human verdict.
 */

export function autoPublishEnabled(): boolean {
  return process.env.AUTO_PUBLISH_ENABLED !== "false";
}

export function minSources(): number {
  const n = Number(process.env.AUTO_PUBLISH_MIN_SOURCES || 2);
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : 2;
}

/** Function words that carry no topical signal. */
const STOPWORDS = new Set([
  "من", "في", "على", "عن", "الى", "إلى", "الذي", "التي", "الذين", "مع", "هذا",
  "هذه", "ذلك", "بعد", "قبل", "خلال", "بين", "حول", "او", "أو", "و", "ان", "أن",
  "إن", "ما", "لا", "لم", "لن", "هو", "هي", "كما", "ايضا", "أيضا", "قال", "قالت",
  "اليوم", "امس", "أمس", "الان", "الآن", "تصريح", "مصادر", "مصدر", "شاهد", "فيديو",
  "مباشر", "تطورات", "تطور", "أحداث", "احداث", "معارك", "مواجهات", "تفاصيل", "تعرف",
]);
// Stopwords are matched after normalisation, so "أحداث" and "احداث" behave the same.
const STOPWORDS_NORM = new Set([...STOPWORDS].map(normalizeTitle));

/** Normalise Arabic text: strip harakat/tatweel, unify letters, drop punctuation. */
export function normalizeTitle(input: string): string {
  // Google News (and many feeds) append " - <publisher>" to every headline;
  // drop that trailing segment so the same story from two outlets compares equal.
  const stripped = input.replace(/\s[-–|]\s[^-–|]{2,30}$/u, "");
  return stripped
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalised, stemmed content words as an array (order preserved). */
export function tokenize(input: string): string[] {
  return normalizeTitle(input)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS_NORM.has(w))
    .map(stem);
}

/**
 * Very light Arabic stemmer. Arabic inflects heavily (استهداف / يستهدفون /
 * استهدفوا), so exact token equality misses the same story across outlets.
 * Stripping the definite article and the common affixes below raises recall
 * without needing a full morphological analyser.
 */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.startsWith("ال")) w = w.slice(2);
  if (w.length > 4 && /^[وفبكل]/.test(w)) w = w.slice(1);
  for (const suffix of ["اتها", "ونها", "يه", "ية", "ون", "ين", "ات", "ها", "هم", "هن", "نا", "وا", "ه"]) {
    if (w.length > 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

/**
 * Actor/institution words that appear in almost every Yemen story. A shared
 * phrase made only of these (e.g. "حوثي تعز") proves nothing, so bigrams that
 * consist solely of them are ignored when matching headlines.
 */
const GENERIC_ACTORS = new Set([
  "قوات", "جيش", "مليشيا", "حوثي", "حوثيون", "تحالف", "حكوم", "حكومه", "شرعي",
  "مقاوم", "مقاومه", "امم", "متحده", "منظمه", "مصدر", "مصادر", "مسؤول", "سلط",
  "محافظ", "رئيس", "وزير", "ناطق", "جيشي", "عسكري", "امني", "شخص", "مدني", "قتل",
  "اصاب", "قصف", "هجوم", "استهداف", "منطقه", "مدينه", "قريه", "حي", "بلد", "دول",
]);

/** Geography — shared by unrelated stories, so it never anchors a match alone. */
const PLACES = new Set([
  "تعز", "عدن", "صنعاء", "الحديده", "مارب", "شبوه", "ابين", "لحج", "حضرموت",
  "المكلا", "سييون", "الضالع", "البيضاء", "الجوف", "صعده", "حجه", "اليمن", "يمن",
  "المندب", "الرياض", "رياض", "السعوديه", "سعود", "الامارات", "ايران", "مصر",
  "عمان", "الخرطوم", "واشنطن", "لندن", "غرب", "شرق", "شمال", "جنوب", "وسط",
]);

/** Words that carry no identifying meaning for a story. */
function isWeak(token: string): boolean {
  return GENERIC_ACTORS.has(token) || PLACES.has(token);
}

/**
 * True when two headlines describe the same story.
 *
 * Two signals are used. First, near-identical wording (one headline contains
 * the other, e.g. an outlet prefixing "اليمن..") is a certain match. Otherwise
 * we count shared *significant* words — tokens that are neither geography nor
 * ubiquitous war vocabulary. Two significant words, or one plus a matching
 * figure, are enough; shared place names alone never are. This keeps unrelated
 * "فجر اليمن" live-blogs apart while still matching a story reworded across
 * outlets.
 */
export function similarTitles(a: string, b: string): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return false;

  const ja = ta.join(" ");
  const jb = tb.join(" ");
  if (ja.length >= 12 && jb.length >= 12 && (ja.includes(jb) || jb.includes(ja))) {
    return true;
  }

  const setB = new Set(tb);
  const shared = ta.filter((w) => setB.has(w));
  if (shared.length < 2) return false;

  const significantShared = shared.filter((w) => !isWeak(w)).length;
  const sharedFigures = shared.filter((t) => /\d/.test(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = shared.length / union;

  return (
    significantShared >= 2 ||
    (significantShared >= 1 && sharedFigures >= 1) ||
    (shared.length >= 5 && jaccard >= 0.5)
  );
}

/** Known-reputable publishers. Only these count toward corroboration. */
const REPUTABLE: { re: RegExp; name: string }[] = [
  { re: /reuters|رويترز/i, name: "رويترز" },
  { re: /al ?jazeera|الجزيرة/i, name: "الجزيرة" },
  { re: /sky ?news|سكاي نيوز/i, name: "سكاي نيوز عربية" },
  { re: /alarabiya|العربية/i, name: "العربية" },
  { re: /cnn/i, name: "CNN" },
  { re: /\bbbc\b/i, name: "BBC" },
  { re: /france ?24/i, name: "France24" },
  { re: /anadolu/i, name: "Anadolu" },
  { re: /euronews/i, name: "Euronews" },
  { re: /un news|الأمم المتحدة|اليونيسف|يونيسف/i, name: "الأمم المتحدة" },
  { re: /saba|سبأ|sabanew/i, name: "وكالة سبأ" },
  { re: /yemen monitor|يمن مونيتور/i, name: "يمن مونيتور" },
  { re: /المصدر أونلاين|almashhad|almashhadalaraby/i, name: "المصدر أونلاين" },
  { re: /عكاظ|okaz/i, name: "عكاظ" },
  { re: /الشرق الأوسط|aawsat/i, name: "الشرق الأوسط" },
  { re: /البيان|albayan/i, name: "البيان" },
  { re: /الحدث|alhadath/i, name: "الحدث" },
  { re: /العربي الجديد|alaraby/i, name: "العربي الجديد" },
  { re: /سكاي|skynewsarabia/i, name: "سكاي نيوز عربية" },
];

/** Canonical reputable publisher for a label/host, or null when unrecognised. */
export function publisherOf(label: string): string | null {
  if (!label) return null;
  const hit = REPUTABLE.find((p) => p.re.test(label));
  return hit ? hit.name : null;
}

const SENSATIONAL = /(عاجل|حصري|انتشر|منتشر|يقولون|مصدر موثوق|بدون دليل|فضيح|فظيع|صادم|انفجار هائل)/;

/**
 * Aggregated headlines (live blogs, round-ups) glue several unrelated events
 * into one title, e.g. "اليمن مباشر.. مقتل 100 حوثي.. والتحالف يعترض صاروخاً".
 * Two of those can look "similar" while describing different events, so they
 * are never auto-published — a human decides what, if anything, to run.
 */
const AGGREGATED = /(مباشر|تغطية حية|تغطية مباشرة|متابعة مباشرة|أحداث وتطورات|ملف اليوم)/;
export function looksAggregated(title: string): boolean {
  const separators = (title.match(/\.\.|…/g) ?? []).length;
  return AGGREGATED.test(title) || separators >= 2;
}

export type AutoPublishOutcome = {
  considered: number;
  published: { id: string; title: string; sources: number; total: number }[];
  skipped: { title: string; reason: string }[];
};

/**
 * Independent reputable publishers that carry the *same* story as `title`.
 *
 * Matching each report to the item is not enough: a headline that bundles two
 * events can match publisher A on one event and publisher B on another, which
 * is not corroboration. So we keep one representative per publisher and return
 * the largest set whose representatives are mutually similar — a genuine
 * multi-source confirmation of a single story.
 */
export async function corroboratingPublishers(title: string): Promise<string[]> {
  const reports = await prisma.report.findMany({
    select: { title: true, origin: true, sourceUrl: true },
    orderBy: { createdAt: "desc" },
    take: 800,
  });

  const byPublisher = new Map<string, string>();
  for (const r of reports) {
    if (!similarTitles(title, r.title)) continue;
    // A live-blog / round-up title bundles several events, so it can match on
    // one event and pair up with an unrelated one. It is not clean evidence.
    if (looksAggregated(r.title)) continue;
    const name = publisherOf(r.origin ?? "") ?? publisherOf(r.sourceUrl ?? "");
    if (name && !byPublisher.has(name)) byPublisher.set(name, r.title);
  }

  const reps = [...byPublisher.entries()];
  let best: string[] = [];
  for (const [nameA] of reps) {
    const clique = [nameA];
    for (const [nameB] of reps) {
      if (nameB === nameA) continue;
      if (clique.every((n) => similarTitles(byPublisher.get(n)!, byPublisher.get(nameB)!))) {
        clique.push(nameB);
      }
    }
    if (clique.length > best.length) best = clique;
  }
  return best;
}

/**
 * If a near-identical story is already published, return it. Google News
 * returns many reworded headlines for one event, so without this guard the same
 * story would be published several times in a row.
 */
async function alreadyPublished(title: string, excludeId: string): Promise<string | null> {
  const published = await prisma.contentItem.findMany({
    where: { status: "PUBLISHED", id: { not: excludeId } },
    select: { id: true, title: true },
    orderBy: { publishedAt: "desc" },
    take: 300,
  });
  for (const p of published) if (similarTitles(title, p.title)) return p.id;
  return null;
}

/**
 * Publish collected NEWS items that are corroborated by >= minSources
 * independent reputable publishers. Idempotent via the `auto-published` tag.
 */
export async function autoPublishCorroboratedNews(limit = 10): Promise<AutoPublishOutcome> {
  const outcome: AutoPublishOutcome = { considered: 0, published: [], skipped: [] };
  if (!autoPublishEnabled()) return outcome;

  const needed = minSources();
  const candidates = await prisma.contentItem.findMany({
    where: {
      kind: "NEWS",
      status: "IN_REVIEW",
      NOT: { tags: { has: "auto-published" } },
      evidence: { some: { url: { not: null } } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const item of candidates) {
    outcome.considered++;
    if (item.title.length < 15) {
      outcome.skipped.push({ title: item.title, reason: "عنوان قصير جداً" });
      continue;
    }
    if (SENSATIONAL.test(item.title)) {
      outcome.skipped.push({ title: item.title, reason: "صياغة إثارة تحتاج مراجعة بشرية" });
      continue;
    }
    if (looksAggregated(item.title)) {
      outcome.skipped.push({ title: item.title, reason: "عنوان مجمّع (تغطية مباشرة) يحتاج مراجعة بشرية" });
      continue;
    }
    const publishers = await corroboratingPublishers(item.title);
    if (publishers.length < needed) {
      outcome.skipped.push({
        title: item.title,
        reason: `توافق ${publishers.length}/${needed} مصادر موثوقة`,
      });
      continue;
    }

    const duplicate = await alreadyPublished(item.title, item.id);
    if (duplicate) {
      // Same event already on the site: keep one story and quietly drop the
      // reworded duplicate instead of publishing it again.
      await prisma.contentItem.update({
        where: { id: item.id },
        data: {
          status: "REJECTED",
          tags: Array.from(new Set([...item.tags, "auto-published", "duplicate"])),
          lastReviewedAt: new Date(),
        },
      });
      outcome.skipped.push({ title: item.title, reason: "مكرر لخبر منشور" });
      continue;
    }

    // Corroboration strength becomes an explicit, transparent confidence record.
    // Note the score is capped by the documented model: with no image/video
    // signals a text-only story tops out in the "صحيح غالباً" band, which is the
    // honest ceiling for corroborated-but-unseen coverage.
    const signals = { source: 95, content: 80, image: 0, video: 0, context: 85, human: 85 };
    const result = score(signals);
    const now = new Date();

    await prisma.$transaction([
      prisma.confidenceRecord.create({
        data: {
          entityType: "ContentItem",
          entityId: item.id,
          contentItemId: item.id,
          sourceScore: signals.source,
          contentScore: signals.content,
          imageScore: signals.image,
          videoScore: signals.video,
          contextScore: signals.context,
          humanScore: signals.human,
          total: result.total,
          verdict: result.verdict,
          breakdown: {
            ...result,
            agent: "autopublish",
            corroboration: publishers,
            reasoning: `تحقق آلي بتوافق ${publishers.length} مصادر مستقلة موثوقة: ${publishers.join(" · ")}.`,
          },
        },
      }),
      prisma.contentItem.update({
        where: { id: item.id },
        data: {
          status: "PUBLISHED",
          verdict: result.verdict,
          confidence: result.total,
          publishedAt: item.publishedAt ?? now,
          lastReviewedAt: now,
          tags: Array.from(new Set([...item.tags, "auto-published", `corroborated:${publishers.length}`])),
        },
      }),
    ]);

    outcome.published.push({ id: item.id, title: item.title, sources: publishers.length, total: result.total });
  }

  return outcome;
}
