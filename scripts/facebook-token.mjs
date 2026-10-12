/**
 * Facebook Page token helper — turns a short-lived user token (from Graph API
 * Explorer) into a never-expiring Page token, then prints the exact env vars.
 *
 * Usage:
 *   FACEBOOK_APP_ID=... FACEBOOK_APP_SECRET=... \
 *   SHORT_LIVED_USER_TOKEN=... node scripts/facebook-token.mjs
 *
 * Steps it performs (the ordering that matters):
 *   1. exchange the short-lived user token for a long-lived (~60d) user token
 *   2. call /me/accounts with the long-lived token -> Page tokens (no expiry)
 */

const GRAPH = "https://graph.facebook.com/v25.0";

const appId = process.env.FACEBOOK_APP_ID;
const appSecret = process.env.FACEBOOK_APP_SECRET;
const shortToken = process.env.SHORT_LIVED_USER_TOKEN;

if (!appId || !appSecret || !shortToken) {
  console.error("مطلوب: FACEBOOK_APP_ID و FACEBOOK_APP_SECRET و SHORT_LIVED_USER_TOKEN");
  process.exit(1);
}

async function getJson(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }
  return json;
}

async function main() {
  const exchanged = await getJson(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${shortToken}`,
  );
  const longUserToken = exchanged.access_token;
  console.log("✓ حصلت على توكن مستخدم طويل الأمد (~60 يوماً).");

  const accounts = await getJson(
    `${GRAPH}/me/accounts?fields=id,name,access_token,category,tasks&access_token=${longUserToken}`,
  );

  const pages = accounts.data ?? [];
  if (pages.length === 0) {
    console.error("✗ لا توجد صفحات. تأكد من صلاحية pages_show_list وأنك مسؤول الصفحة.");
    process.exit(1);
  }

  console.log(`\nوجدت ${pages.length} صفحة:\n`);
  for (const page of pages) {
    console.log(`• ${page.name}  (id: ${page.id})`);
    console.log(`  FACEBOOK_PAGE_ID=${page.id}`);
    console.log(`  FACEBOOK_ACCESS_TOKEN=${page.access_token}`);
    console.log("");
  }
  console.log("انسخ القيم للصفحة التي تريدها إلى .env ثم أعد التشغيل.");
}

main().catch((err) => {
  console.error("✗ فشل:", err.message);
  process.exit(1);
});
