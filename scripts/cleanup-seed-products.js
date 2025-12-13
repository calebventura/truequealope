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

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

async function main() {
  loadEnvLocal();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error(
      "Faltan env vars. Necesitas NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY (puede estar en .env.local)."
    );
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

  const count = clampInt(getArg("--count") ?? "50", 1, 200);
  const yes = hasFlag("--yes");

  if (!yes) {
    console.error("Modo seguro: ejecuta con --yes para borrar el seed.");
    process.exit(1);
  }

  console.log(`Proyecto: ${projectId}`);
  console.log(`Borrando seed (hasta ${count} docs)...`);

  const ids = Array.from({ length: count }, (_, i) => `seed_${String(i + 1).padStart(4, "0")}`);
  const batches = chunk(ids, 400);
  let deleted = 0;

  for (const group of batches) {
    const batch = db.batch();
    for (const id of group) {
      batch.delete(db.collection("products").doc(id));
    }
    await batch.commit();
    deleted += group.length;
    console.log(`Batch OK: ${deleted}/${ids.length}`);
  }

  console.log("Listo. Seed eliminado (docs de products).");
  console.log("Nota: si algún producto seed tuvo subcolecciones, no se eliminan automáticamente.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

