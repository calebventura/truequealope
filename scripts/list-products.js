/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key) continue;
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function parseList(raw) {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  loadEnvLocal();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error(
      "Missing env vars. Need NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
    );
    process.exit(1);
  }

  const categoryIds = parseList(getArg("--categoryIds"));
  const statuses = parseList(getArg("--status"));
  const limit = Number(getArg("--limit") ?? "20");

  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
      }),
    });
  }

  const db = admin.firestore();
  let queryRef = db.collection("products");

  if (statuses.length > 0) {
    queryRef = queryRef.where("status", "in", statuses);
  }

  if (Number.isFinite(limit) && limit > 0) {
    queryRef = queryRef.limit(Math.min(limit, 100));
  }

  const snap = await queryRef.get();
  let products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (categoryIds.length > 0) {
    const categorySet = new Set(categoryIds);
    products = products.filter((item) => categorySet.has(item.categoryId));
  }

  const lines = products.map((item) => {
    const title = String(item.title ?? "").slice(0, 80);
    const category = item.categoryId ?? "-";
    const status = item.status ?? "-";
    const tags = Array.isArray(item.trendTags) ? item.trendTags.join("|") : "-";
    return `${item.id}\t${title}\t${category}\t${status}\t${tags}`;
  });

  console.log(`Project: ${projectId}`);
  console.log(`Total: ${lines.length}`);
  console.log("id\ttitle\tcategory\tstatus\ttrendTags");
  for (const line of lines) console.log(line);

  const ids = products.map((item) => item.id);
  if (ids.length) {
    console.log("");
    console.log(`productIds: ${ids.join(",")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
