import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/**
 * Registra un clic de contacto (WhatsApp u otros canales futuros) para un producto.
 */
export async function logContactClick(
  productId: string,
  userId: string,
  sellerId: string,
  channel: "whatsapp" | "instagram" | "other" = "whatsapp",
) {
  const productRef = doc(db, "products", productId);
  await addDoc(collection(productRef, "contactLogs"), {
    userId,
    sellerId,
    channel,
    createdAt: serverTimestamp(),
  });
}

/**
 * Devuelve el total de clics de contacto registrados para un producto.
 * Solo debe llamarse cuando el usuario es el vendedor (reglas de seguridad lo validan).
 * Requiere sellerId para cumplir con las reglas de seguridad de Firestore (query-based rules).
 */
export async function getContactClicksCount(productId: string, sellerId: string) {
  const productRef = doc(db, "products", productId);
  const q = query(
    collection(productRef, "contactLogs"),
    where("sellerId", "==", sellerId)
  );
  const countSnap = await getCountFromServer(q);
  return countSnap.data().count || 0;
}
