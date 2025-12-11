import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/**
 * Registra un clic de contacto (WhatsApp u otros canales futuros) para un producto.
 */
export async function logContactClick(
  productId: string,
  userId: string,
  channel: "whatsapp" | "other" = "whatsapp",
) {
  const productRef = doc(db, "products", productId);
  await addDoc(collection(productRef, "contactLogs"), {
    userId,
    channel,
    createdAt: serverTimestamp(),
  });
}

/**
 * Devuelve el total de clics de contacto registrados para un producto.
 * Solo debe llamarse cuando el usuario es el vendedor (reglas de seguridad lo validan).
 */
export async function getContactClicksCount(productId: string) {
  const productRef = doc(db, "products", productId);
  const countSnap = await getCountFromServer(collection(productRef, "contactLogs"));
  return countSnap.data().count || 0;
}
