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

function pad4(n) {
  return String(n).padStart(4, "0");
}

function clampInt(n, min, max) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function shortText(text, max = 22) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return "Producto";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trim()}…`;
}

function createPlaceholderImages(title, index) {
  const t = encodeURIComponent(shortText(title, 18));
  const a = index % 2 === 0 ? "EEF2FF/1E1B4B" : "ECFEFF/164E63";
  const b = index % 2 === 0 ? "F1F5F9/0F172A" : "FDF2F8/831843";
  return [
    `https://placehold.co/600x600/${a}/png?text=${t}`,
    `https://placehold.co/600x600/${b}/png?text=${t}`,
  ];
}

function normalizeKeywords(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);
}

const LIMA_DISTRICTS = [
  "Ancón",
  "Ate",
  "Barranco",
  "Breña",
  "Carabayllo",
  "Chaclacayo",
  "Chorrillos",
  "Cieneguilla",
  "Comas",
  "El Agustino",
  "Independencia",
  "Jesús María",
  "La Molina",
  "La Victoria",
  "Lima",
  "Lince",
  "Los Olivos",
  "Lurigancho-Chosica",
  "Lurín",
  "Magdalena del Mar",
  "Miraflores",
  "Pachacámac",
  "Pucusana",
  "Pueblo Libre",
  "Puente Piedra",
  "Punta Hermosa",
  "Punta Negra",
  "Rímac",
  "San Bartolo",
  "San Borja",
  "San Isidro",
  "San Juan de Lurigancho",
  "San Juan de Miraflores",
  "San Luis",
  "San Martín de Porres",
  "San Miguel",
  "Santa Anita",
  "Santa María del Mar",
  "Santa Rosa",
  "Santiago de Surco",
  "Surquillo",
  "Villa El Salvador",
  "Villa María del Triunfo",
];

const WANTED_POOL = [
  "celular",
  "audífonos",
  "tablet",
  "consola",
  "bicicleta",
  "mancuernas",
  "zapatillas",
  "casaca",
  "mochila",
  "libros",
  "juguetes",
  "silla de oficina",
  "microondas",
  "parlante",
  "smartwatch",
];

const BASE_PRODUCTS = [
  { title: "Bicicleta MTB aro 29", categoryId: "sports" },
  { title: "Mancuernas ajustables 20kg", categoryId: "sports" },
  { title: "Scooter plegable", categoryId: "sports" },
  { title: "Mat de yoga antideslizante", categoryId: "sports" },
  { title: "Pelota de fútbol talla 5", categoryId: "sports" },
  { title: "Raqueta de tenis", categoryId: "sports" },
  { title: "Patines en línea", categoryId: "sports" },
  { title: "Cuerda para saltar", categoryId: "sports" },

  { title: "Laptop Lenovo ThinkPad i5", categoryId: "electronics" },
  { title: "Smart TV 43\" Full HD", categoryId: "electronics" },
  { title: "Audífonos Bluetooth", categoryId: "electronics" },
  { title: "Parlante portátil", categoryId: "electronics" },
  { title: "Consola PlayStation 4", categoryId: "electronics" },
  { title: "Nintendo Switch Lite", categoryId: "electronics" },
  { title: "Cámara Canon (básica)", categoryId: "electronics" },
  { title: "Tablet 10\" Android", categoryId: "electronics" },

  { title: "Zapatillas urbanas", categoryId: "clothing" },
  { title: "Casaca impermeable", categoryId: "clothing" },
  { title: "Mochila para laptop", categoryId: "clothing" },
  { title: "Chompa de lana", categoryId: "clothing" },
  { title: "Jeans slim fit", categoryId: "clothing" },
  { title: "Vestido casual", categoryId: "clothing" },
  { title: "Gorra deportiva", categoryId: "clothing" },
  { title: "Reloj deportivo", categoryId: "clothing" },

  { title: "Silla de oficina ergonómica", categoryId: "home" },
  { title: "Mesa auxiliar", categoryId: "home" },
  { title: "Licuadora", categoryId: "home" },
  { title: "Horno microondas", categoryId: "home" },
  { title: "Lámpara de escritorio", categoryId: "home" },
  { title: "Juego de sábanas", categoryId: "home" },
  { title: "Organizador de cocina", categoryId: "home" },
  { title: "Estante metálico", categoryId: "home" },

  { title: "Set LEGO pequeño", categoryId: "toys" },
  { title: "Carrito a control remoto", categoryId: "toys" },
  { title: "Rompecabezas 1000 piezas", categoryId: "toys" },
  { title: "Muñeca articulada", categoryId: "toys" },
  { title: "Juego de mesa UNO", categoryId: "toys" },
  { title: "Juego de mesa Jenga", categoryId: "toys" },
  { title: "Peluchito grande", categoryId: "toys" },
  { title: "Pista de carros", categoryId: "toys" },

  { title: "Colección de novelas (3)", categoryId: "books" },
  { title: "Libro de cocina peruana", categoryId: "books" },
  { title: "Libro de finanzas personal", categoryId: "books" },
  { title: "Cómics (pack)", categoryId: "books" },
  { title: "Libro infantil ilustrado", categoryId: "books" },
  { title: "Libro de programación", categoryId: "books" },
  { title: "Diccionario inglés-español", categoryId: "books" },
  { title: "Guía de viajes Perú", categoryId: "books" },

  { title: "Guitarra acústica", categoryId: "other" },
  { title: "Maceta con planta (mediana)", categoryId: "other" },
  { title: "Herramientas básicas (kit)", categoryId: "other" },
  { title: "Termo de acero", categoryId: "other" },
  { title: "Cuadro decorativo", categoryId: "other" },
  { title: "Juego de tazas", categoryId: "other" },
  { title: "Set de pintura", categoryId: "other" },
  { title: "Maleta de viaje", categoryId: "other" },
];

function pickWanted(index) {
  const count = 1 + (index % 3); // 1..3
  const start = index % WANTED_POOL.length;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(WANTED_POOL[(start + i * 3) % WANTED_POOL.length]);
  }
  return Array.from(new Set(out));
}

function modeFor(index) {
  const pattern = ["sale", "trade", "both", "sale", "both", "trade"];
  return pattern[index % pattern.length];
}

function conditionFor(index) {
  const options = ["used", "like-new", "new"];
  return options[index % options.length];
}

function priceFor(index) {
  // 10..100 (Soles) determinístico
  return 10 + ((index * 7) % 91);
}

function buildSeedProducts({ sellerId, count }) {
  const now = Date.now();
  const items = BASE_PRODUCTS.slice(0, count);

  return items.map((base, index) => {
    const mode = modeFor(index);
    const district = LIMA_DISTRICTS[index % LIMA_DISTRICTS.length];
    const condition = conditionFor(index);
    const price = mode === "trade" ? null : priceFor(index);
    const wanted = mode === "sale" ? [] : pickWanted(index);

    const title = base.title;
    const description = [
      "Producto en buen estado.",
      `Entrega coordinada en ${district}.`,
      mode === "trade"
        ? `Busco a cambio: ${wanted.join(", ")}.`
        : mode === "both"
        ? `También acepto trueque (busco: ${wanted.join(", ")}).`
        : "Venta directa por WhatsApp.",
    ].join(" ");

    const trendTags = [];
    if ((base.categoryId === "home" || base.categoryId === "other") && index % 4 === 0) {
      trendTags.push("moving-urgent");
    }

    return {
      id: `seed_${pad4(index + 1)}`,
      data: {
        sellerId,
        title,
        description,
        price,
        categoryId: base.categoryId,
        images: createPlaceholderImages(title, index),
        status: "active",
        condition,
        location: district,
        createdAt: new Date(now - index * 60 * 60 * 1000),
        mode,
        wanted,
        searchKeywords: normalizeKeywords(title),
        trendTags: trendTags.length > 0 ? trendTags : undefined,
        seed: true,
      },
    };
  });
}

async function resolveSellerUid(admin, db) {
  const sellerUidFromArg = getArg("--sellerUid");
  const sellerUidFromEnv = process.env.SEED_SELLER_UID;
  const sellerEmailFromArg = getArg("--sellerEmail");
  const sellerEmailFromEnv = process.env.SEED_SELLER_EMAIL;

  const sellerUid = sellerUidFromArg ?? sellerUidFromEnv;
  if (sellerUid) return sellerUid;

  const email = sellerEmailFromArg ?? sellerEmailFromEnv;
  if (email) {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid;
  }

  // Auto: si hay 1 solo usuario en Auth, usamos ese.
  const list = await admin.auth().listUsers(2);
  if (list.users.length === 1 && !list.pageToken) {
    const only = list.users[0];
    console.log(
      "SEED: no se indicó seller uid/email; usando el único usuario encontrado en Auth."
    );
    console.log(`SEED_SELLER_UID=${only.uid}`);
    return only.uid;
  }

  // Auto (fallback): si hay 1 solo documento en users/, usamos ese.
  const usersSnap = await db.collection("users").limit(2).get();
  if (usersSnap.size === 1) {
    const onlyDoc = usersSnap.docs[0];
    console.log(
      "SEED: no se indicó seller uid/email; usando el único documento encontrado en users/."
    );
    console.log(`SEED_SELLER_UID=${onlyDoc.id}`);
    return onlyDoc.id;
  }

  throw new Error(
    "No pude determinar el seller. Pasa --sellerEmail tu@email.com o --sellerUid <uid>."
  );
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
  const dryRun = hasFlag("--dry-run");
  const yes = hasFlag("--yes");

  if (!dryRun && !yes) {
    console.error(
      "Modo seguro: ejecuta con --dry-run para previsualizar o --yes para escribir en Firestore."
    );
    process.exit(1);
  }

  console.log(`Proyecto: ${projectId}`);
  const sellerId = await resolveSellerUid(admin, db);
  console.log(`Seller: ${sellerId}`);

  const seedProducts = buildSeedProducts({ sellerId, count });
  console.log(`Productos a upsert: ${seedProducts.length}`);

  if (dryRun) {
    console.log("Dry run. Ejemplo del primer producto:");
    console.log(JSON.stringify(seedProducts[0], null, 2));
    return;
  }

  console.log("Escribiendo productos (batch)...");
  const batches = chunk(seedProducts, 400);
  let written = 0;

  for (const group of batches) {
    const batch = db.batch();
    for (const item of group) {
      const ref = db.collection("products").doc(item.id);
      batch.set(ref, item.data, { merge: true });
    }
    await batch.commit();
    written += group.length;
    console.log(`Batch OK: ${written}/${seedProducts.length}`);
  }

  console.log("Listo. Catálogo seed creado/actualizado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
