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

async function main() {
  loadEnvLocal();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.error(
      "Faltan env vars. Asegúrate de tener NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY (puede estar en .env.local)."
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

  console.log("Backfill: contactLogs.sellerId (solo faltantes)...");

  const productsSnap = await db.collection("products").get();
  console.log(`Productos: ${productsSnap.size}`);

  let updated = 0;
  let scannedLogs = 0;

  for (const productDoc of productsSnap.docs) {
    const productData = productDoc.data();
    const sellerId = productData.sellerId;
    if (!sellerId) continue;

    const logsRef = db.collection("products").doc(productDoc.id).collection("contactLogs");
    const missingSellerSnap = await logsRef.where("sellerId", "==", null).get();
    if (missingSellerSnap.empty) continue;

    let batch = db.batch();
    let ops = 0;

    for (const logDoc of missingSellerSnap.docs) {
      scannedLogs += 1;
      batch.update(logDoc.ref, { sellerId });
      ops += 1;
      updated += 1;

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }
  }

  console.log(`Logs escaneados: ${scannedLogs}`);
  console.log(`Logs actualizados: ${updated}`);
  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
