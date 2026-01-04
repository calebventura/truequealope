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

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseList(raw) {
  return String(raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(items) {
  return Array.from(new Set(items));
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

  const productIds = parseList(getArg("--productIds"));
  const addTags = parseList(getArg("--addTags"));
  const removeTags = parseList(getArg("--removeTags"));
  const dryRun = hasFlag("--dry-run");
  const yes = hasFlag("--yes");

  if (!productIds.length) {
    console.error("Pass --productIds id1,id2,id3");
    process.exit(1);
  }

  if (!addTags.length && !removeTags.length) {
    console.error("Pass --addTags and/or --removeTags");
    process.exit(1);
  }

  if (!dryRun && !yes) {
    console.error("Safe mode: use --dry-run to preview or --yes to write.");
    process.exit(1);
  }

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
  const FieldValue = admin.firestore.FieldValue;

  console.log(`Project: ${projectId}`);
  console.log(`Products: ${productIds.length}`);
  console.log(`Add tags: ${addTags.join(", ") || "-"}`);
  console.log(`Remove tags: ${removeTags.join(", ") || "-"}`);

  const updates = [];
  for (const id of productIds) {
    const ref = db.collection("products").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`Missing product: ${id}`);
      continue;
    }

    const data = snap.data() || {};
    const current = Array.isArray(data.trendTags) ? data.trendTags : [];
    const next = uniq(
      current
        .filter((tag) => !removeTags.includes(tag))
        .concat(addTags)
    );

    if (JSON.stringify(current) === JSON.stringify(next)) {
      console.log(`No changes: ${id}`);
      continue;
    }

    updates.push({ ref, id, current, next });
  }

  if (dryRun) {
    for (const item of updates) {
      console.log(`${item.id}: ${JSON.stringify(item.current)} -> ${JSON.stringify(item.next)}`);
    }
    return;
  }

  const batch = db.batch();
  for (const item of updates) {
    batch.update(item.ref, {
      trendTags: item.next.length ? item.next : FieldValue.delete(),
    });
  }
  await batch.commit();
  console.log(`Updated products: ${updates.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
