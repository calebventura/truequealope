import * as admin from 'firebase-admin';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const missingEnv: string[] = [];
if (!projectId) missingEnv.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
if (!clientEmail) missingEnv.push("FIREBASE_CLIENT_EMAIL");
if (!privateKey) missingEnv.push("FIREBASE_PRIVATE_KEY");

let initError: Error | null = null;

if (missingEnv.length === 0) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
  } catch (err) {
    initError = err as Error;
    console.error("Failed to initialize Firebase Admin SDK:", err);
  }
} else {
  initError = new Error(
    `Missing Firebase Admin env vars: ${missingEnv.join(", ")}`
  );
  console.error(initError.message);
}

const throwIfInitError = <T extends object>(name: string): T =>
  new Proxy({} as T, {
    get() {
      throw initError ?? new Error(`Firebase Admin not initialized (${name})`);
    },
  });

export const adminAuth = initError ? throwIfInitError<ReturnType<typeof admin.auth>>("auth") : admin.auth();
export const adminDb = initError ? throwIfInitError<ReturnType<typeof admin.firestore>>("firestore") : admin.firestore();
