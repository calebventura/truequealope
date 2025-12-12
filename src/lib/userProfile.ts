import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

export async function ensureUserProfile(user: User) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  const base = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    updatedAt: serverTimestamp(),
  } as const;

  if (!snap.exists()) {
    await setDoc(
      userRef,
      {
        ...base,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await setDoc(userRef, base, { merge: true });
}

